import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) return [];
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
  },
});

export const get = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) return null;
    return message;
  },
});

/**
 * Insert the user's message plus an assistant placeholder, then kick off
 * generation. The client streams the answer back reactively by subscribing
 * to `list` (text) and `audio.getSegments` (speech).
 */
export const send = mutation({
  args: { conversationId: v.id("conversations"), content: v.string() },
  handler: async (ctx, { conversationId, content }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    const trimmed = content.trim();
    if (trimmed.length === 0) throw new Error("Empty message");

    await ctx.db.insert("messages", {
      conversationId,
      userId,
      role: "user",
      content: trimmed,
      status: "complete",
    });
    const assistantMessageId = await ctx.db.insert("messages", {
      conversationId,
      userId,
      role: "assistant",
      content: "",
      status: "pending",
    });
    await ctx.db.patch(conversationId, { updatedAt: Date.now() });

    await ctx.scheduler.runAfter(0, internal.ai.generate, {
      conversationId,
      assistantMessageId,
    });
    return assistantMessageId;
  },
});

/** Full prior transcript for the Claude request, oldest first. */
export const history = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    assistantMessageId: v.id("messages"),
  },
  handler: async (ctx, { conversationId, assistantMessageId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    return messages
      .filter((m) => m._id !== assistantMessageId && m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
  },
});

export const getConversation = internalQuery({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return await ctx.db.get(conversationId);
  },
});

export const getMessage = internalQuery({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    return await ctx.db.get(messageId);
  },
});

export const updateContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    status: v.union(
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, content, status, error }) => {
    await ctx.db.patch(messageId, { content, status, error });
  },
});
