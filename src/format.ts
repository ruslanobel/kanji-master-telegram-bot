import type { KanjiEntry } from "./types.js";
import { escapeHtml, toRomaji } from "./utils.js";

const CAPTION_LIMIT = 1024;

function joinList(items: string[]): string {
  return items.length ? items.join("、") : "—";
}

/** Prefer kun, fall back to on. Display keeps kana type; dots stripped. */
function primaryReading(entry: KanjiEntry): string | undefined {
  const raw = entry.kun[0] ?? entry.on[0];
  if (!raw) return undefined;
  const display = raw.replace(/[.\u30fb\s]/g, "");
  return display || undefined;
}

export function formatTitle(entry: KanjiEntry): string {
  const reading = primaryReading(entry);
  if (!reading) return "—";
  const romaji = toRomaji(reading);
  return romaji ? `${reading} · ${romaji}` : reading;
}

export function formatDescription(entry: KanjiEntry): string {
  const meanings = (entry.meaningsRu.length ? entry.meaningsRu : entry.meaningsEn)
    .slice(0, 3)
    .join("; ");
  return meanings || "Кандзи";
}

/** HTML caption for inline Article / animation edit (Telegram caption limit). */
export function formatCaption(entry: KanjiEntry): string {
  const meanings = entry.meaningsRu.length ? entry.meaningsRu : entry.meaningsEn;
  const meaningLine = meanings.length
    ? meanings.slice(0, 6).map(escapeHtml).join("; ")
    : "—";

  const lines = [
    `<b>${escapeHtml(entry.literal)}</b>`,
    `Он: ${escapeHtml(joinList(entry.on))}`,
    `Кун: ${escapeHtml(joinList(entry.kun))}`,
    `Перевод: ${meaningLine}`,
  ];

  if (entry.jlpt) lines.push(`JLPT: N${entry.jlpt}`);

  for (const ex of entry.examples.slice(0, 2)) {
    const next = `${lines.join("\n")}\nПример: <b>${escapeHtml(ex.word)}</b>（${escapeHtml(ex.reading)}）— ${escapeHtml(ex.gloss)}`;
    if (next.length <= CAPTION_LIMIT) {
      lines.push(
        `Пример: <b>${escapeHtml(ex.word)}</b>（${escapeHtml(ex.reading)}）— ${escapeHtml(ex.gloss)}`,
      );
    }
  }

  let caption = lines.join("\n");
  if (caption.length > CAPTION_LIMIT) {
    caption = `${caption.slice(0, CAPTION_LIMIT - 1)}…`;
  }
  return caption;
}

export function formatHelp(botUsername: string): string {
  return [
    "<b>Поиск кандзи</b>",
    "",
    `В любом чате набери <code>@${escapeHtml(botUsername)}</code> и запрос:`,
    "• сам иероглиф — <code>水</code>",
    "• он/кун — <code>スイ</code> или <code>みず</code>",
    "• перевод — <code>вода</code>",
    "",
    "В списке — статичное превью. После выбора нажми «Написание» для анимации.",
    "",
    "Данные: KANJIDIC / JMdict (русские значения из JMdict).",
    "Анимация: KanjiVG © Ulrich Apel (CC BY-SA 3.0), CDN jsDelivr.",
  ].join("\n");
}
