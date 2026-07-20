import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KanjiEntry, SearchIndex } from "./types.js";
import { normalizeMeaning, normalizeReading } from "./utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = join(root, "data", "index.json");

let cached: SearchIndex | null = null;

export function loadIndex(): SearchIndex {
  if (cached) return cached;
  cached = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as SearchIndex;
  return cached;
}

function scoreEntry(entry: KanjiEntry, q: string, readingQ: string, meaningQ: string): number {
  if (!q) return 0;

  // Exact literal
  if (entry.literal === q) return 1000;

  let score = 0;

  for (const on of entry.on) {
    const n = normalizeReading(on);
    if (n === readingQ) score = Math.max(score, 900);
    else if (readingQ && n.startsWith(readingQ)) score = Math.max(score, 700);
    else if (readingQ && n.includes(readingQ)) score = Math.max(score, 500);
  }

  for (const kun of entry.kun) {
    const n = normalizeReading(kun);
    if (n === readingQ) score = Math.max(score, 900);
    else if (readingQ && n.startsWith(readingQ)) score = Math.max(score, 700);
    else if (readingQ && n.includes(readingQ)) score = Math.max(score, 500);
  }

  for (const m of entry.meaningsRu) {
    const n = normalizeMeaning(m);
    if (n === meaningQ) score = Math.max(score, 850);
    else if (meaningQ && n.startsWith(meaningQ)) score = Math.max(score, 650);
    else if (meaningQ && n.includes(meaningQ)) score = Math.max(score, 450);
  }

  for (const m of entry.meaningsEn) {
    const n = normalizeMeaning(m);
    if (meaningQ && n.includes(meaningQ)) score = Math.max(score, 300);
  }

  for (const ex of entry.examples) {
    const g = normalizeMeaning(ex.gloss);
    if (meaningQ && g.includes(meaningQ)) score = Math.max(score, 400);
    const r = normalizeReading(ex.reading);
    if (readingQ && r.includes(readingQ)) score = Math.max(score, 350);
  }

  return score;
}

export function searchKanji(query: string, limit = 20): KanjiEntry[] {
  const q = query.trim();
  if (!q) return [];

  const index = loadIndex();
  const readingQ = normalizeReading(q);
  const meaningQ = normalizeMeaning(q);

  const scored: { entry: KanjiEntry; score: number }[] = [];
  for (const entry of index.entries) {
    const score = scoreEntry(entry, q, readingQ, meaningQ);
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ga = a.entry.grade ?? 99;
    const gb = b.entry.grade ?? 99;
    if (ga !== gb) return ga - gb;
    return (a.entry.strokeCount ?? 99) - (b.entry.strokeCount ?? 99);
  });

  return scored.slice(0, limit).map((s) => s.entry);
}
