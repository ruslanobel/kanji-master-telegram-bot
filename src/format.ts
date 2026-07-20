import type { KanjiEntry } from "./types.js";
import { escapeHtml } from "./utils.js";

const CAPTION_LIMIT = 1024;

function joinList(items: string[]): string {
  return items.length ? items.join("、") : "—";
}

export function formatTitle(entry: KanjiEntry): string {
  const meaning =
    entry.meaningsRu[0] ?? entry.meaningsEn[0] ?? "без перевода";
  const on = entry.on[0] ?? "—";
  const kun = entry.kun[0] ?? "—";
  return `${entry.literal} · ${on} / ${kun} · ${meaning}`;
}

export function formatDescription(entry: KanjiEntry): string {
  const meanings = (entry.meaningsRu.length ? entry.meaningsRu : entry.meaningsEn)
    .slice(0, 3)
    .join("; ");
  return meanings || "Кандзи";
}

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

  if (entry.jlpt) {
    lines.push(`JLPT: N${entry.jlpt}`);
  }

  for (const ex of entry.examples.slice(0, 2)) {
    const candidate = `${lines.join("\n")}\nПример: <b>${escapeHtml(ex.word)}</b>（${escapeHtml(ex.reading)}）— ${escapeHtml(ex.gloss)}`;
    if (candidate.length <= CAPTION_LIMIT) {
      lines.push(
        `Пример: <b>${escapeHtml(ex.word)}</b>（${escapeHtml(ex.reading)}）— ${escapeHtml(ex.gloss)}`,
      );
    }
  }

  let caption = lines.join("\n");
  if (caption.length > CAPTION_LIMIT) {
    caption = caption.slice(0, CAPTION_LIMIT - 1) + "…";
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
    "Выбери вариант из списка — придёт карточка; кнопка «Написание» покажет анимацию.",
    "",
    "Данные: KANJIDIC / JMdict (русские значения из JMdict).",
    "Анимация: KanjiVG © Ulrich Apel (CC BY-SA 3.0), CDN jsDelivr.",
  ].join("\n");
}
