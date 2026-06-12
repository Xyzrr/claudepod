# ClaudePod 🎧

Long-form voice conversations with Claude — the Claude chat experience, but you
**listen** instead of read. Ask a question at the gym, hear a lecture-quality
answer between sets, say "stop" when your set starts.

Architecture and conventions: see [agents.html](./agents.html).

## Setup

```sh
bun install
bunx convex dev --once    # provision/link a Convex dev deployment
bun run setup-auth        # one-time: install Convex Auth JWT keys + SITE_URL
cp .env.example .env      # then fill in your API keys
bun run sync-env          # push keys to the Convex deployment
```

## Run

```sh
bun run dev:backend       # convex dev (terminal 1)
bun run dev               # vite on http://localhost:5173 (terminal 2)
```

Open it on your phone (same network or a tunnel), Add to Home Screen, and it
behaves like a native app.

## Keys you need

| Env var             | Used for                                  |
| ------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY` | Claude (`claude-fable-5`)                 |
| `DEEPGRAM_API_KEY`  | Streaming speech-to-text                  |
| `ELEVENLABS_API_KEY`| Text-to-speech (default provider)         |
| `OPENAI_API_KEY`    | Optional TTS fallback (`TTS_PROVIDER=openai`) |
