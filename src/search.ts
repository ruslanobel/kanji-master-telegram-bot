import { readFileSync } from "node:fs";
import type { KanjiEntry, SearchIndex } from "./types.js";
import { resolveDataPath } from "./paths.js";
import { normalizeMeaning, normalizeReading, russianReadingToRomaji, toRomaji } from "./utils.js";

let cached: SearchIndex | null = null;

export function loadIndex(): SearchIndex {
  if (cached) return cached;
  const path = resolveDataPath("index.json");
  cached = JSON.parse(readFileSync(path, "utf8")) as SearchIndex;
  return cached;
}

export function getKanjiByLiteral(literal: string): KanjiEntry | undefined {
  return loadIndex().entries.find((e) => e.literal === literal);
}

export function getKanjiByCodepoint(hex: string): KanjiEntry | undefined {
  const normalized = hex.toLowerCase().padStart(5, "0");
  return loadIndex().entries.find((e) => e.codepoint === normalized);
}

/** Latin romaji or Russian phonetic transcription → romaji for reading match. */
function normalizeRomajiQuery(q: string): string {
  const t = q.trim().toLowerCase();
  if (!t) return "";
  if (/^[a-z']+$/.test(t)) return t.replaceAll("'", "");
  if (/^[а-яёъь']+$/i.test(t)) return russianReadingToRomaji(t);
  return "";
}

function scoreReading(
  reading: string,
  readingQ: string,
  romajiQ: string,
): number {
  let score = 0;
  const n = normalizeReading(reading);
  if (readingQ) {
    if (n === readingQ) score = Math.max(score, 900);
    else if (n.startsWith(readingQ)) score = Math.max(score, 700);
    else if (n.includes(readingQ)) score = Math.max(score, 500);
  }
  if (romajiQ) {
    const romaji = toRomaji(reading).replaceAll("'", "");
    if (romaji === romajiQ) score = Math.max(score, 900);
    else if (romaji.startsWith(romajiQ)) score = Math.max(score, 700);
    else if (romaji.includes(romajiQ)) score = Math.max(score, 500);
  }
  return score;
}

function scoreEntry(
  entry: KanjiEntry,
  q: string,
  readingQ: string,
  meaningQ: string,
  romajiQ: string,
): number {
  if (!q) return 0;

  // Exact literal
  if (entry.literal === q) return 1000;

  let score = 0;

  for (const on of entry.on) {
    score = Math.max(score, scoreReading(on, readingQ, romajiQ));
  }
  for (const kun of entry.kun) {
    score = Math.max(score, scoreReading(kun, readingQ, romajiQ));
  }

  // Meanings: Russian only (no English fallback in ranking).
  for (const m of entry.meaningsRu) {
    const n = normalizeMeaning(m);
    if (n === meaningQ) score = Math.max(score, 850);
    else if (meaningQ && n.startsWith(meaningQ)) score = Math.max(score, 650);
    else if (meaningQ && n.includes(meaningQ)) score = Math.max(score, 450);
  }

  for (const ex of entry.examples) {
    const g = normalizeMeaning(ex.gloss);
    if (meaningQ && g.includes(meaningQ)) score = Math.max(score, 400);
    const r = normalizeReading(ex.reading);
    if (readingQ && r.includes(readingQ)) score = Math.max(score, 350);
    if (romajiQ) {
      const romaji = toRomaji(ex.reading).replaceAll("'", "");
      if (romaji === romajiQ) score = Math.max(score, 350);
      else if (romaji.includes(romajiQ)) score = Math.max(score, 300);
    }
  }

  return score;
}

export function searchKanji(query: string, limit = 20): KanjiEntry[] {
  const q = query.trim();
  if (!q) return [];

  const index = loadIndex();
  const readingQ = normalizeReading(q);
  const meaningQ = normalizeMeaning(q);
  const romajiQ = normalizeRomajiQuery(q);

  const scored: { entry: KanjiEntry; score: number }[] = [];
  for (const entry of index.entries) {
    const score = scoreEntry(entry, q, readingQ, meaningQ, romajiQ);
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const quality = (e: KanjiEntry) => {
      let q = 0;
      if (e.meaningsRu.length) q += 100;
      if (e.jlpt) q += 40;
      if (e.grade && e.grade <= 8) q += 30;
      return q;
    };
    const qa = quality(a.entry);
    const qb = quality(b.entry);
    if (qb !== qa) return qb - qa;
    const ga = a.entry.grade ?? 99;
    const gb = b.entry.grade ?? 99;
    if (ga !== gb) return ga - gb;
    return (a.entry.strokeCount ?? 99) - (b.entry.strokeCount ?? 99);
  });

  // Drop obscure hits without Russian gloss (unless exact literal match).
  return scored
    .filter(
      (s) =>
        s.score >= 1000 ||
        s.entry.meaningsRu.length > 0 ||
        s.entry.jlpt != null,
    )
    .slice(0, limit)
    .map((s) => s.entry);
}
