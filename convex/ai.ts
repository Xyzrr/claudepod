"use node";

import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { CLAUDE_MODEL, MAX_RESPONSE_TOKENS } from "./appConfig";
import { SPOKEN_SYSTEM_PROMPT, TITLE_PROMPT } from "./prompts";
import { SentenceChunker } from "./lib/chunker";
import { getTtsProvider } from "./tts";
import type { SynthesisContext } from "./tts/types";

function anthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set on the Convex deployment (run `bun run sync-env`)",
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Synthesize one chunk and persist it as a ready audio segment. Returns the
 * provider's request id (when exposed) so the caller can stitch the next
 * chunk's request to this one for consistent loudness/prosody.
 */
async function synthesizeSegment(
  ctx: ActionCtx,
  args: {
    messageId: Id<"messages">;
    conversationId: Id<"conversations">;
    index: number;
    text: string;
  },
  stitch?: SynthesisContext,
): Promise<string | undefined> {
  const segmentId = await ctx.runMutation(internal.audio.createSegment, args);
  try {
    const provider = getTtsProvider();
    const result = await provider.synthesize(args.text, stitch);
    const storageId = await ctx.storage.store(
      new Blob([result.data], { type: result.mimeType }),
    );
    await ctx.runMutation(internal.audio.markSegmentReady, {
      segmentId,
      storageId,
      durationSec: result.durationSec,
      provider: provider.name,
    });
    return result.requestId;
  } catch (error) {
    await ctx.runMutation(internal.audio.markSegmentError, {
      segmentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Rolling stitching context across the chunks of one message. previousText
 * always advances (it reflects the script, even if a chunk's audio failed);
 * request ids are only appended for successful generations.
 */
function makeStitchTracker() {
  let previousText: string | undefined;
  let previousRequestIds: string[] = [];
  return {
    current(): SynthesisContext {
      return { previousText, previousRequestIds };
    },
    advance(text: string, requestId: string | undefined) {
      previousText = text;
      if (requestId) {
        previousRequestIds = [...previousRequestIds, requestId].slice(-3);
      }
    },
  };
}

/**
 * Stream a Claude response into the assistant message document while
 * synthesizing TTS for completed sentence-chunks in parallel, so playback of
 * the beginning starts while the end is still being generated.
 */
export const generate = internalAction({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, { conversationId, assistantMessageId }) => {
    const history = await ctx.runQuery(internal.messages.history, {
      conversationId,
      assistantMessageId,
    });

    const update = (
      content: string,
      status: "streaming" | "complete" | "error",
      error?: string,
    ) =>
      ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content,
        status,
        error,
      });

    const chunker = new SentenceChunker();
    let fullText = "";
    let segmentIndex = 0;
    let lastDbWrite = 0;
    // Sequential synthesis queue: keeps segment order, provider rate limits,
    // and the stitching chain sane while the Claude stream keeps flowing.
    let synthQueue: Promise<void> = Promise.resolve();
    const stitch = makeStitchTracker();

    const enqueueChunk = (text: string) => {
      const index = segmentIndex++;
      synthQueue = synthQueue.then(async () => {
        const requestId = await synthesizeSegment(
          ctx,
          {
            messageId: assistantMessageId,
            conversationId,
            index,
            text,
          },
          stitch.current(),
        );
        stitch.advance(text, requestId);
      });
    };

    try {
      const client = anthropicClient();
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: MAX_RESPONSE_TOKENS,
        thinking: { type: "adaptive" },
        system: SPOKEN_SYSTEM_PROMPT,
        messages: history,
      });

      stream.on("text", (delta) => {
        fullText += delta;
        for (const chunk of chunker.push(delta)) enqueueChunk(chunk);
        const now = Date.now();
        if (now - lastDbWrite > 350) {
          lastDbWrite = now;
          void update(fullText, "streaming");
        }
      });

      await stream.finalMessage();

      const rest = chunker.flush();
      if (rest !== null) enqueueChunk(rest);
      await update(fullText, "complete");
      await synthQueue;

      await maybeGenerateTitle(ctx, conversationId, history);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await synthQueue.catch(() => {});
      await update(
        fullText,
        "error",
        `Claude request failed: ${message}`,
      );
    }
  },
});

async function maybeGenerateTitle(
  ctx: ActionCtx,
  conversationId: Id<"conversations">,
  history: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const conversation = await ctx.runQuery(internal.messages.getConversation, {
    conversationId,
  });
  if (!conversation || conversation.title !== "New conversation") return;
  const firstUserMessage = history.find((m) => m.role === "user");
  if (!firstUserMessage) return;

  try {
    const client = anthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 64,
      messages: [
        {
          role: "user",
          content: `${TITLE_PROMPT}\n\n${firstUserMessage.content.slice(0, 600)}`,
        },
      ],
    });
    const title = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "")
      .slice(0, 60);
    if (title) {
      await ctx.runMutation(internal.conversations.setTitle, {
        conversationId,
        title,
      });
    }
  } catch {
    // Title generation is cosmetic — never fail the conversation over it.
  }
}

/**
 * Re-create TTS audio for an existing completed message (e.g. resuming an
 * old conversation whose audio failed or was generated before a provider
 * switch).
 */
export const regenerateAudio = action({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.runQuery(internal.messages.getMessage, {
      messageId,
    });
    if (!message || message.role !== "assistant" || !message.content.trim()) {
      throw new Error("Nothing to synthesize");
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null || message.userId !== userId) {
      throw new Error("Not signed in");
    }

    await ctx.runMutation(internal.audio.clearSegments, { messageId });

    const chunker = new SentenceChunker();
    const chunks = chunker.push(message.content);
    const rest = chunker.flush();
    if (rest !== null) chunks.push(rest);

    const stitch = makeStitchTracker();
    for (let index = 0; index < chunks.length; index++) {
      const requestId = await synthesizeSegment(
        ctx,
        {
          messageId,
          conversationId: message.conversationId,
          index,
          text: chunks[index],
        },
        stitch.current(),
      );
      stitch.advance(chunks[index], requestId);
    }
  },
});
