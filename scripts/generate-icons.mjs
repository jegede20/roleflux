// Optional: generate PNG PWA icons from public/icons/icon.svg
//
//   npm i -D sharp
//   node scripts/generate-icons.mjs
//
// The app works with the SVG icon alone; PNGs improve compatibility with
// older Android launchers and iOS home-screen icons.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Install sharp first:  npm i -D sharp");
    process.exit(1);
  }

  const svg = await readFile(join(root, "public/icons/icon.svg"));
  for (const size of [192, 512]) {
    const out = join(root, `public/icons/icon-${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log("wrote", out);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
