import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_SILENCE_MS,
  MAX_SILENCE_MS,
  MIN_SILENCE_MS,
} from "./appConfig";

const DEFAULTS = {
  silenceMs: DEFAULT_SILENCE_MS,
  playbackRate: DEFAULT_PLAYBACK_RATE,
  autoPlay: true,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return DEFAULTS;
    const row = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return DEFAULTS;
    const { silenceMs, playbackRate, autoPlay } = row;
    return { silenceMs, playbackRate, autoPlay };
  },
});

export const update = mutation({
  args: {
    silenceMs: v.optional(v.number()),
    playbackRate: v.optional(v.number()),
    autoPlay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const next = {
      ...DEFAULTS,
      ...(existing
        ? {
            silenceMs: existing.silenceMs,
            playbackRate: existing.playbackRate,
            autoPlay: existing.autoPlay,
          }
        : {}),
      ...Object.fromEntries(
        Object.entries(args).filter(([, value]) => value !== undefined),
      ),
    };
    next.silenceMs = Math.min(MAX_SILENCE_MS, Math.max(MIN_SILENCE_MS, next.silenceMs));

    if (existing) {
      await ctx.db.patch(existing._id, next);
    } else {
      await ctx.db.insert("settings", { userId, ...next });
    }
  },
});
