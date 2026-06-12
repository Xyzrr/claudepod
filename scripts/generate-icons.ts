/**
 * Rasterize scripts/icon.svg into the PWA icon set using rsvg-convert
 * (brew install librsvg). Run: bun run icons
 */
import { $ } from "bun";

const svg = new URL("./icon.svg", import.meta.url).pathname;
const outDir = new URL("../public/icons/", import.meta.url).pathname;

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 }, // full-bleed bg → maskable-safe
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of targets) {
  await $`rsvg-convert -w ${size} -h ${size} -o ${outDir}${file} ${svg}`;
  console.log(`wrote public/icons/${file}`);
}
