/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as appConfig from "../appConfig.js";
import type * as audio from "../audio.js";
import type * as auth from "../auth.js";
import type * as conversations from "../conversations.js";
import type * as http from "../http.js";
import type * as lib_chunker from "../lib/chunker.js";
import type * as messages from "../messages.js";
import type * as prompts from "../prompts.js";
import type * as settings from "../settings.js";
import type * as stt from "../stt.js";
import type * as tts_elevenlabs from "../tts/elevenlabs.js";
import type * as tts_index from "../tts/index.js";
import type * as tts_openai from "../tts/openai.js";
import type * as tts_types from "../tts/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  appConfig: typeof appConfig;
  audio: typeof audio;
  auth: typeof auth;
  conversations: typeof conversations;
  http: typeof http;
  "lib/chunker": typeof lib_chunker;
  messages: typeof messages;
  prompts: typeof prompts;
  settings: typeof settings;
  stt: typeof stt;
  "tts/elevenlabs": typeof tts_elevenlabs;
  "tts/index": typeof tts_index;
  "tts/openai": typeof tts_openai;
  "tts/types": typeof tts_types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
