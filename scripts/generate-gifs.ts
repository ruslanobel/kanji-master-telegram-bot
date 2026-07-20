import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKanjiMp4 } from "../src/lib/kanji-gif.js";
import type { SearchIndex } from "../src/types.js";
import { toCodepoint } from "../src/utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = join(root, "data", "index.json");
const MP4_DIR = join(root, "assets", "mp4");
const CONCURRENCY = 3;

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<void> {
  if (!existsSync(INDEX_PATH)) {
    throw new Error("data/index.json missing. Run npm run build:data first.");
  }

  const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as SearchIndex;
  mkdirSync(MP4_DIR, { recursive: true });

  const targets = index.entries.filter((e) => {
    const graded = typeof e.grade === "number" && e.grade >= 1 && e.grade <= 8;
    const jlpt = typeof e.jlpt === "number";
    return graded || jlpt;
  });

  console.log(`Generating MP4 for ${targets.length} kanji (concurrency=${CONCURRENCY})…`);
  let ok = 0;
  let fail = 0;
  let done = 0;

  await mapPool(targets, CONCURRENCY, async (entry) => {
    const out = join(MP4_DIR, `${toCodepoint(entry.literal)}.mp4`);
    if (existsSync(out)) {
      ok++;
      done++;
      return;
    }
    try {
      await generateKanjiMp4(entry.literal, out);
      ok++;
    } catch (err) {
      fail++;
      console.warn(`Skip ${entry.literal}:`, (err as Error).message);
    }
    done++;
    if (done % 50 === 0) {
      console.log(`Progress ${done}/${targets.length} (ok=${ok}, fail=${fail})`);
    }
  });

  console.log(`Done. ok=${ok}, fail=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
