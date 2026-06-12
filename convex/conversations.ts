import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return await Promise.all(
      conversations.map(async (c) => {
        const segments = await ctx.db
          .query("audioSegments")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .collect();
        const totalDurationSec = segments.reduce(
          (sum, s) => sum + (s.durationSec ?? 0),
          0,
        );
        return { ...c, totalDurationSec };
      }),
    );
  },
});

export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) return null;
    return conversation;
  },
});

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    return await ctx.db.insert("conversations", {
      userId,
      title: "New conversation",
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .collect();
    for (const message of messages) {
      const segments = await ctx.db
        .query("audioSegments")
        .withIndex("by_message", (q) => q.eq("messageId", message._id))
        .collect();
      for (const segment of segments) {
        if (segment.storageId) await ctx.storage.delete(segment.storageId);
        await ctx.db.delete(segment._id);
      }
      await ctx.db.delete(message._id);
    }
    await ctx.db.delete(conversationId);
  },
});

export const setTitle = internalMutation({
  args: { conversationId: v.id("conversations"), title: v.string() },
  handler: async (ctx, { conversationId, title }) => {
    await ctx.db.patch(conversationId, { title });
  },
});

export const touch = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    await ctx.db.patch(conversationId, { updatedAt: Date.now() });
  },
});
