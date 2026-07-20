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

/** Hepburn romaji from hiragana/katakana (okurigana dots already stripped). */
export function toRomaji(kana: string): string {
  const hira = normalizeReading(kana);
  if (!hira) return "";

  const digraphs: Record<string, string> = {
    きゃ: "kya",
    きゅ: "kyu",
    きょ: "kyo",
    しゃ: "sha",
    しゅ: "shu",
    しょ: "sho",
    ちゃ: "cha",
    ちゅ: "chu",
    ちょ: "cho",
    にゃ: "nya",
    にゅ: "nyu",
    にょ: "nyo",
    ひゃ: "hya",
    ひゅ: "hyu",
    ひょ: "hyo",
    みゃ: "mya",
    みゅ: "myu",
    みょ: "myo",
    りゃ: "rya",
    りゅ: "ryu",
    りょ: "ryo",
    ぎゃ: "gya",
    ぎゅ: "gyu",
    ぎょ: "gyo",
    じゃ: "ja",
    じゅ: "ju",
    じょ: "jo",
    びゃ: "bya",
    びゅ: "byu",
    びょ: "byo",
    ぴゃ: "pya",
    ぴゅ: "pyu",
    ぴょ: "pyo",
  };

  const singles: Record<string, string> = {
    あ: "a",
    い: "i",
    う: "u",
    え: "e",
    お: "o",
    か: "ka",
    き: "ki",
    く: "ku",
    け: "ke",
    こ: "ko",
    さ: "sa",
    し: "shi",
    す: "su",
    せ: "se",
    そ: "so",
    た: "ta",
    ち: "chi",
    つ: "tsu",
    て: "te",
    と: "to",
    な: "na",
    に: "ni",
    ぬ: "nu",
    ね: "ne",
    の: "no",
    は: "ha",
    ひ: "hi",
    ふ: "fu",
    へ: "he",
    ほ: "ho",
    ま: "ma",
    み: "mi",
    む: "mu",
    め: "me",
    も: "mo",
    や: "ya",
    ゆ: "yu",
    よ: "yo",
    ら: "ra",
    り: "ri",
    る: "ru",
    れ: "re",
    ろ: "ro",
    わ: "wa",
    ゐ: "wi",
    ゑ: "we",
    を: "o",
    ん: "n",
    が: "ga",
    ぎ: "gi",
    ぐ: "gu",
    げ: "ge",
    ご: "go",
    ざ: "za",
    じ: "ji",
    ず: "zu",
    ぜ: "ze",
    ぞ: "zo",
    だ: "da",
    ぢ: "ji",
    づ: "zu",
    で: "de",
    ど: "do",
    ば: "ba",
    び: "bi",
    ぶ: "bu",
    べ: "be",
    ぼ: "bo",
    ぱ: "pa",
    ぴ: "pi",
    ぷ: "pu",
    ぺ: "pe",
    ぽ: "po",
    ぁ: "a",
    ぃ: "i",
    ぅ: "u",
    ぇ: "e",
    ぉ: "o",
    ゃ: "ya",
    ゅ: "yu",
    ょ: "yo",
    っ: "",
    ー: "",
  };

  let out = "";
  for (let i = 0; i < hira.length; ) {
    if (hira[i] === "っ") {
      const next = hira.slice(i + 1, i + 3);
      const dig = digraphs[next] ?? singles[hira[i + 1] ?? ""];
      const cons = dig?.match(/^[bcdfghjklmnpqrstvwxyz]/i)?.[0];
      if (cons) out += cons.toLowerCase();
      i += 1;
      continue;
    }

    if (hira[i] === "ん") {
      const rest = hira.slice(i + 1);
      const nextRomaji =
        digraphs[rest.slice(0, 2)] ?? singles[rest[0] ?? ""] ?? "";
      out += /^[aeiouy]/i.test(nextRomaji) ? "n'" : "n";
      i += 1;
      continue;
    }

    const two = hira.slice(i, i + 2);
    if (digraphs[two]) {
      out += digraphs[two];
      i += 2;
      continue;
    }

    const one = hira[i]!;
    if (one === "ー") {
      const m = out.match(/[aeiou]$/);
      if (m) out += m[0];
      i += 1;
      continue;
    }

    out += singles[one] ?? one;
    i += 1;
  }

  return out;
}
