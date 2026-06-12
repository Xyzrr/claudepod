/**
 * Production deploy: Convex prod functions + frontend build → Vercel.
 *
 * 1. `convex deploy` pushes functions to the prod deployment and runs the
 *    vite build with VITE_CONVEX_URL pointed at it.
 * 2. The dist/ output is wrapped in Vercel's Build Output API format (no
 *    remote build) and shipped with `vercel deploy --prebuilt --prod`.
 *
 * Needs VERCEL_TOKEN in .env. First-time prod setup also needs:
 *   bun run setup-auth -- --prod   and   bun run sync-env -- --prod
 */
import { $ } from "bun";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";

const env: Record<string, string> = {};
for (const line of (await Bun.file(".env").text()).split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].trim();
}
const token = env.VERCEL_TOKEN;
if (!token) {
  console.error("VERCEL_TOKEN missing from .env");
  process.exit(1);
}

await $`bunx convex deploy --yes --cmd ${"bunx vite build"}`;

mkdirSync(".vercel/output/static", { recursive: true });
cpSync("dist", ".vercel/output/static", { recursive: true });
writeFileSync(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/index.html" }],
    },
    null,
    2,
  ),
);

await $`bunx vercel deploy --prebuilt --prod --yes --token ${token}`;
console.log("\nLive at https://claudepod.vercel.app");
