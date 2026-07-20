import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import type { KanjiEntry, KanjiExample, SearchIndex } from "../src/types.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = join(root, "data", "raw");
const OUT_PATH = join(root, "data", "index.json");

const RELEASE = "3.6.2+20260713141310";
const TAG = encodeURIComponent(RELEASE);
const BASE = `https://github.com/scriptin/jmdict-simplified/releases/download/${TAG}`;

type KanjidicReading = { type: string; value: string };
type KanjidicMeaning = { lang?: string; value: string };
type KanjidicCharacter = {
  literal: string;
  misc?: {
    grade?: number;
    strokeCounts?: number[];
    jlptLevel?: number;
  };
  readingMeaning?: {
    groups?: Array<{
      readings?: KanjidicReading[];
      meanings?: KanjidicMeaning[];
    }>;
  };
};

type KanjidicFile = { characters: KanjidicCharacter[] };

type JmdictGloss = { lang?: string; text: string };
type JmdictSense = { gloss?: JmdictGloss[] };
type JmdictKanji = { text: string };
type JmdictKana = { text: string };
type JmdictEntry = {
  kanji?: JmdictKanji[];
  kana?: JmdictKana[];
  sense?: JmdictSense[];
};

type JmdictFile = { words: JmdictEntry[] };

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    console.log(`Cached: ${dest}`);
    return;
  }
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function unzipTo(zipPath: string, outDir: string): void {
  mkdirSync(outDir, { recursive: true });
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", outDir], { stdio: "inherit" });
}

function findJson(dir: string, prefix: string): string {
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const name of readdirSync(cur, { withFileTypes: true })) {
      const p = join(cur, name.name);
      if (name.isDirectory()) stack.push(p);
      else if (name.name.startsWith(prefix) && name.name.endsWith(".json")) return p;
    }
  }
  throw new Error(`JSON with prefix ${prefix} not found in ${dir}`);
}

function isKanjiChar(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

function collectKanjiFromWord(text: string): string[] {
  const out: string[] = [];
  for (const ch of text) {
    if (isKanjiChar(ch) && !out.includes(ch)) out.push(ch);
  }
  return out;
}

function entryHasKnownKanji(form: string, map: Map<string, KanjiEntry>): boolean {
  return collectKanjiFromWord(form).some((k) => map.has(k));
}

/** Strip numbering / braces noise from Warodai-style glosses. */
function cleanGloss(text: string): string {
  return text
    .replace(/^\d+\)\s*/g, "")
    .replace(/^\{[^}]+\}\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });

  const kanjiZip = join(RAW_DIR, "kanjidic2-en.zip");
  const jmdictZip = join(RAW_DIR, "jmdict-rus.zip");
  await download(`${BASE}/kanjidic2-en-${RELEASE}.json.zip`, kanjiZip);
  await download(`${BASE}/jmdict-rus-${RELEASE}.json.zip`, jmdictZip);

  const kanjiDir = join(RAW_DIR, "kanjidic");
  const jmdictDir = join(RAW_DIR, "jmdict");
  rmSync(kanjiDir, { recursive: true, force: true });
  rmSync(jmdictDir, { recursive: true, force: true });
  unzipTo(kanjiZip, kanjiDir);
  unzipTo(jmdictZip, jmdictDir);

  const kanjidic = JSON.parse(
    readFileSync(findJson(kanjiDir, "kanjidic2-en"), "utf8"),
  ) as KanjidicFile;
  const jmdict = JSON.parse(
    readFileSync(findJson(jmdictDir, "jmdict-rus"), "utf8"),
  ) as JmdictFile;

  const byLiteral = new Map<string, KanjiEntry>();

  for (const ch of kanjidic.characters) {
    if (!ch.literal || [...ch.literal].length !== 1) continue;
    const on: string[] = [];
    const kun: string[] = [];
    const meaningsEn: string[] = [];

    for (const group of ch.readingMeaning?.groups ?? []) {
      for (const r of group.readings ?? []) {
        if (r.type === "ja_on") on.push(r.value);
        if (r.type === "ja_kun") kun.push(r.value.replace(/-$/, ""));
      }
      for (const m of group.meanings ?? []) {
        if (!m.lang || m.lang === "en") meaningsEn.push(m.value);
      }
    }

    byLiteral.set(ch.literal, {
      literal: ch.literal,
      codepoint: ch.literal.codePointAt(0)!.toString(16).padStart(5, "0"),
      on: [...new Set(on)],
      kun: [...new Set(kun)],
      meaningsRu: [],
      meaningsEn: [...new Set(meaningsEn)],
      examples: [],
      jlpt: ch.misc?.jlptLevel ?? undefined,
      grade: ch.misc?.grade ?? undefined,
      strokeCount: ch.misc?.strokeCounts?.[0],
    });
  }

  for (const word of jmdict.words) {
    const glosses = (word.sense ?? [])
      .flatMap((s) => s.gloss ?? [])
      .filter((g) => !g.lang || g.lang === "rus" || g.lang === "ru")
      .map((g) => cleanGloss(g.text))
      .filter(Boolean);
    if (!glosses.length) continue;

    const kanjiForms = (word.kanji ?? []).map((k) => k.text).filter(Boolean);
    const reading = (word.kana ?? [])[0]?.text ?? "";
    if (!kanjiForms.length) continue;

    for (const form of kanjiForms) {
      if ([...form].length === 1 && isKanjiChar(form)) {
        const entry = byLiteral.get(form);
        if (!entry) continue;
        for (const g of glosses.slice(0, 6)) {
          if (!entry.meaningsRu.includes(g)) entry.meaningsRu.push(g);
        }
        if (reading && entry.examples.every((e) => e.word !== form)) {
          entry.examples.unshift({ word: form, reading, gloss: glosses[0] });
          entry.examples = entry.examples.slice(0, 3);
        }
      }

      if (form.length >= 2 && form.length <= 4 && entryHasKnownKanji(form, byLiteral)) {
        const example: KanjiExample = {
          word: form,
          reading,
          gloss: glosses[0],
        };
        for (const k of collectKanjiFromWord(form)) {
          const entry = byLiteral.get(k);
          if (!entry) continue;
          if (entry.examples.length >= 3) continue;
          if (entry.examples.some((e) => e.word === form)) continue;
          entry.examples.push(example);
        }
      }
    }
  }

  const entries = [...byLiteral.values()].filter(
    (e) => e.on.length || e.kun.length || e.meaningsRu.length || e.meaningsEn.length,
  );

  const index: SearchIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    entries,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(index));
  console.log(`Wrote ${entries.length} kanji → ${OUT_PATH}`);
  console.log(`With Russian glosses: ${entries.filter((e) => e.meaningsRu.length).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
