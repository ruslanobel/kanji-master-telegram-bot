import type { InputRichMessage, InputRichMessageMedia } from "grammy/types";
import { animationMp4Url } from "./animations.js";
import type { KanjiEntry } from "./types.js";
import { escapeHtml, toRomaji } from "./utils.js";

const CAPTION_LIMIT = 1024;
const ANIM_MEDIA_ID = "anim";

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

/** Escape free text for Telegram Rich Markdown (inline / table cells). */
function escapeRichMd(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("`", "\\`")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function readingsTable(entry: KanjiEntry): string {
  const rows = Math.max(entry.on.length, entry.kun.length, 1);
  const lines = [
    "| Онъёми | Кунъёми |",
    "| --- | --- |",
  ];
  for (let i = 0; i < rows; i++) {
    const on = escapeRichMd(entry.on[i] ?? "");
    const kun = escapeRichMd(entry.kun[i] ?? "");
    lines.push(`| ${on} | ${kun} |`);
  }
  return lines.join("\n");
}

export function formatTitle(entry: KanjiEntry): string {
  const reading = primaryReading(entry);
  if (!reading) return entry.literal;
  const romaji = toRomaji(reading);
  const rest = romaji ? `${reading} · ${romaji}` : reading;
  return `${entry.literal} · ${rest}`;
}

/** Russian glosses only — never fall back to English. */
function meaningsRu(entry: KanjiEntry): string[] {
  return entry.meaningsRu;
}

export function formatDescription(
  entry: KanjiEntry,
  options: { animationUnavailable?: boolean } = {},
): string {
  const meanings = meaningsRu(entry).slice(0, 3).join("; ") || "Кандзи";
  if (options.animationUnavailable) return `${meanings} · без анимации`;
  return meanings;
}

/** HTML caption for legacy animation edits (Telegram caption limit). */
export function formatCaption(entry: KanjiEntry): string {
  const meanings = meaningsRu(entry);
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

export type RichAnimationSource =
  | { type: "none" }
  /** HTTP URL in markdown — works in editMessage*, not in answerInlineQuery. */
  | { type: "url" }
  /**
   * Preferred for inline answers: reference via tg://video?id=…
   * `media` may be a Telegram file_id or (sometimes) an HTTPS URL.
   */
  | { type: "ref"; media: string };

/**
 * Rich Message matching the Notion card layout.
 * Animation is placed after the JLPT line (better on mobile).
 */
export function formatRichMessage(
  entry: KanjiEntry,
  options: {
    animation?: RichAnimationSource;
    /** Show a note when stroke animation is not in our assets. */
    animationUnavailable?: boolean;
  } = {},
): InputRichMessage {
  const animation: RichAnimationSource = options.animation ?? { type: "url" };
  const meanings = meaningsRu(entry);
  const parts: string[] = [];
  let media: InputRichMessageMedia[] | undefined;

  parts.push(`# ${escapeRichMd(entry.literal)}`);

  if (entry.jlpt) {
    parts.push(`*JLPT: N${entry.jlpt}*`);
  }

  if (animation.type === "ref") {
    parts.push("", `![](tg://video?id=${ANIM_MEDIA_ID})`, "");
    media = [
      {
        id: ANIM_MEDIA_ID,
        media: { type: "animation", media: animation.media },
      },
    ];
  } else if (animation.type === "url") {
    parts.push("", `![](${animationMp4Url(entry.literal)})`, "");
  } else if (options.animationUnavailable) {
    parts.push("", "*Анимация написания недоступна*", "");
  }

  parts.push("---", "", "## Чтения", "", readingsTable(entry), "", "---", "", "## Перевод", "");

  if (meanings.length) {
    for (const m of meanings.slice(0, 8)) {
      parts.push(`- ${escapeRichMd(m)}`);
    }
  } else {
    parts.push("- —");
  }

  parts.push("", "---", "", "## Примеры", "");

  const examples = entry.examples.slice(0, 5);
  if (examples.length) {
    for (const ex of examples) {
      parts.push(
        `- **${escapeRichMd(ex.word)}**（${escapeRichMd(ex.reading)}）— ${escapeRichMd(ex.gloss)}`,
      );
    }
  } else {
    parts.push("- —");
  }

  return media ? { markdown: parts.join("\n"), media } : { markdown: parts.join("\n") };
}

export function formatHelp(botUsername: string): string {
  return [
    "<b>Поиск кандзи</b>",
    "",
    "<b>В личке с ботом</b>",
    "Напиши запрос и <b>отправь</b> сообщение (не только введи в поле):",
    "• <code>вода</code> · <code>мизу</code> · <code>mizu</code> · <code>水</code>",
    "Или нажми «Искать здесь» — откроется inline-поиск.",
    "",
    `<b>В Избранном и других чатах</b>`,
    `1) Нажми «В Избранное / другой чат» — Telegram сам подставит <code>@${escapeHtml(botUsername)}</code>`,
    `2) Либо вручную: <code>@${escapeHtml(botUsername)} вода</code> (нужен пробел после ника)`,
    "",
    "Подсказка @ появляется после /start и недавнего использования бота.",
    "",
    "Данные: KANJIDIC / JMdict. Анимация: KanjiVG (CC BY-SA 3.0).",
  ].join("\n");
}
