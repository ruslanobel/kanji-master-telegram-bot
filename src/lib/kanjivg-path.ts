import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toCodepoint } from "../utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const KANJIVG_DIR = join(root, "assets", "kanjivg");

/** True if KanjiVG stroke SVG exists on disk (local/dev only). */
export function hasKanjiVg(literal: string): boolean {
  const hex = toCodepoint(literal);
  return (
    existsSync(join(KANJIVG_DIR, "kanji", `${hex}.svg`)) ||
    existsSync(join(KANJIVG_DIR, `${hex}.svg`))
  );
}

export function kanjiVgDir(): string {
  return KANJIVG_DIR;
}
