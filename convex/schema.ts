import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_user", ["userId", "updatedAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(
      v.literal("pending"), // assistant placeholder, generation not started
      v.literal("streaming"), // text still arriving from Claude
      v.literal("complete"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
  }).index("by_conversation", ["conversationId"]),

  // One row per TTS sentence-chunk of an assistant message. Together the
  // ordered segments form the "chapter" audio timeline for that message.
  audioSegments: defineTable({
    messageId: v.id("messages"),
    conversationId: v.id("conversations"),
    index: v.number(),
    text: v.string(),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    storageId: v.optional(v.id("_storage")),
    durationSec: v.optional(v.number()), // server estimate, refined by client metadata
    provider: v.optional(v.string()),
    error: v.optional(v.string()),
  })
    .index("by_message", ["messageId", "index"])
    .index("by_conversation", ["conversationId"]),

  settings: defineTable({
    userId: v.id("users"),
    silenceMs: v.number(),
    playbackRate: v.number(),
    autoPlay: v.boolean(),
  }).index("by_user", ["userId"]),
});
