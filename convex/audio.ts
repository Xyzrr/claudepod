import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Ordered TTS segments for a message, with playable URLs. The client treats
 * the list as one virtual audio timeline (scrubbing, skip, elapsed/remaining).
 */
export const getSegments = query({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const message = await ctx.db.get(messageId);
    if (!message || message.userId !== userId) return [];

    const segments = await ctx.db
      .query("audioSegments")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect();
    segments.sort((a, b) => a.index - b.index);

    return await Promise.all(
      segments.map(async (s) => ({
        _id: s._id,
        index: s.index,
        text: s.text,
        status: s.status,
        durationSec: s.durationSec,
        url: s.storageId ? await ctx.storage.getUrl(s.storageId) : null,
      })),
    );
  },
});

/** Client-measured exact duration (from audio element metadata). */
export const setSegmentDuration = mutation({
  args: { segmentId: v.id("audioSegments"), durationSec: v.number() },
  handler: async (ctx, { segmentId, durationSec }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const segment = await ctx.db.get(segmentId);
    if (!segment) return;
    const message = await ctx.db.get(segment.messageId);
    if (!message || message.userId !== userId) return;
    if (durationSec > 0 && Number.isFinite(durationSec)) {
      await ctx.db.patch(segmentId, { durationSec });
    }
  },
});

export const createSegment = internalMutation({
  args: {
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    index: v.number(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("audioSegments", { ...args, status: "pending" });
  },
});

export const markSegmentReady = internalMutation({
  args: {
    segmentId: v.id("audioSegments"),
    storageId: v.id("_storage"),
    durationSec: v.optional(v.number()),
    provider: v.string(),
  },
  handler: async (ctx, { segmentId, storageId, durationSec, provider }) => {
    await ctx.db.patch(segmentId, {
      status: "ready",
      storageId,
      durationSec,
      provider,
    });
  },
});

export const markSegmentError = internalMutation({
  args: { segmentId: v.id("audioSegments"), error: v.string() },
  handler: async (ctx, { segmentId, error }) => {
    await ctx.db.patch(segmentId, { status: "error", error });
  },
});

/** Drop all segments for a message (before regeneration). */
export const clearSegments = internalMutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, { messageId }) => {
    const segments = await ctx.db
      .query("audioSegments")
      .withIndex("by_message", (q) => q.eq("messageId", messageId))
      .collect();
    for (const segment of segments) {
      if (segment.storageId) await ctx.storage.delete(segment.storageId);
      await ctx.db.delete(segment._id);
    }
  },
});
