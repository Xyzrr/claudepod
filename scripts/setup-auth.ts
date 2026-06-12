/**
 * One-time Convex Auth key setup: generates the RS256 keypair Convex Auth
 * uses to sign/verify JWTs and stores it on the active Convex deployment
 * (JWT_PRIVATE_KEY + JWKS), plus SITE_URL. Run after `bunx convex dev` has
 * provisioned a deployment: bun run setup-auth
 */
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { $ } from "bun";

// Pass --prod to target the production deployment instead of dev.
const target = process.argv.includes("--prod") ? ["--prod"] : [];

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...publicKey }] });

await $`bunx convex env set ${target} JWT_PRIVATE_KEY -- ${privateKey}`;
await $`bunx convex env set ${target} JWKS -- ${jwks}`;

const siteUrl = process.env.SITE_URL ?? "http://localhost:5173";
await $`bunx convex env set ${target} SITE_URL ${siteUrl}`;

console.log("Convex Auth keys installed on the deployment.");
