import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKanjiPreview } from "../src/lib/kanji-gif.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MP4_DIR = join(root, "assets", "mp4");
const PREVIEW_DIR = join(root, "assets", "preview");
const CONCURRENCY = 8;

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]);
      }
    }),
  );
}

async function main(): Promise<void> {
  if (!existsSync(MP4_DIR)) {
    throw new Error("assets/mp4 missing — run npm run build:gifs first");
  }
  mkdirSync(PREVIEW_DIR, { recursive: true });

  const files = readdirSync(MP4_DIR).filter((f) => f.endsWith(".mp4"));
  console.log(`Generating ${files.length} JPEG previews…`);

  let ok = 0;
  let fail = 0;
  let done = 0;

  await mapPool(files, CONCURRENCY, async (file) => {
    const hex = file.replace(/\.mp4$/, "");
    const literal = String.fromCodePoint(Number.parseInt(hex, 16));
    const out = join(PREVIEW_DIR, `${hex}.jpg`);
    if (existsSync(out)) {
      ok++;
      done++;
      return;
    }
    try {
      await generateKanjiPreview(literal, out);
      ok++;
    } catch (err) {
      fail++;
      console.warn(`Skip ${literal}:`, (err as Error).message);
    }
    done++;
    if (done % 100 === 0) console.log(`Progress ${done}/${files.length}`);
  });

  console.log(`Done. ok=${ok}, fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
