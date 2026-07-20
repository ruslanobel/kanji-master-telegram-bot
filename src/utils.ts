/** Unicode codepoint hex used for KanjiVG filenames (e.g. 6c34). */
export function toCodepoint(literal: string): string {
  const cp = literal.codePointAt(0);
  if (cp === undefined) {
    throw new Error(`Empty literal`);
  }
  return cp.toString(16).padStart(5, "0");
}

/** Katakana → hiragana; strip reading dots and whitespace. */
export function normalizeReading(input: string): string {
  return [...input.trim()]
    .map((ch) => {
      const code = ch.codePointAt(0)!;
      // Katakana block → hiragana
      if (code >= 0x30a1 && code <= 0x30f6) {
        return String.fromCodePoint(code - 0x60);
      }
      return ch;
    })
    .join("")
    .replace(/[.\u30fb\s\-ー]/g, "")
    .toLowerCase();
}

export function normalizeMeaning(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
