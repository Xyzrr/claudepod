import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Mint a short-lived Deepgram token so the browser can open a streaming
 * WebSocket directly to Deepgram without ever seeing the real API key.
 */
export const getDeepgramToken = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in");

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      throw new Error(
        "DEEPGRAM_API_KEY is not set on the Convex deployment (run `bun run sync-env`)",
      );
    }

    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Deepgram token grant failed (${response.status}): ${body}`);
    }
    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },
});
