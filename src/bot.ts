import { Bot, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import { animationMp4Url, animationPreviewUrl } from "./animations.js";
import { formatCaption, formatDescription, formatHelp, formatTitle } from "./format.js";
import { getKanjiByCodepoint, searchKanji } from "./search.js";
import type { KanjiEntry } from "./types.js";

const INLINE_LIMIT = 10;

function animKeyboard(entry: KanjiEntry): InlineKeyboard {
  // callback_data max 64 bytes — codepoint hex is short
  return new InlineKeyboard().text("▶️ Написание", `anim:${entry.codepoint}`);
}

async function showAnimation(
  api: Bot["api"],
  entry: KanjiEntry,
  target: { inlineMessageId: string } | { chatId: number; messageId: number },
): Promise<void> {
  const media = {
    type: "animation" as const,
    media: animationMp4Url(entry.literal),
    caption: formatCaption(entry),
    parse_mode: "HTML" as const,
  };

  if ("inlineMessageId" in target) {
    await api.editMessageMediaInline(target.inlineMessageId, media);
  } else {
    await api.editMessageMedia(target.chatId, target.messageId, media);
  }
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const username = ctx.me.username ?? "bot";
    await ctx.reply(formatHelp(username), { parse_mode: "HTML" });
  });

  bot.command("help", async (ctx) => {
    const username = ctx.me.username ?? "bot";
    await ctx.reply(formatHelp(username), { parse_mode: "HTML" });
  });

  bot.on("inline_query", async (ctx) => {
    const q = ctx.inlineQuery.query.trim();
    const results = [];

    if (!q) {
      results.push(
        InlineQueryResultBuilder.article("hint", "Введите запрос", {
          description: "кандзи, чтение (みず) или перевод (вода)",
        }).text(
          "Введите кандзи, он/кун чтение или русский перевод после @бота.",
        ),
      );
      await ctx.answerInlineQuery(results, { cache_time: 5, is_personal: false });
      return;
    }

    const matches = searchKanji(q, INLINE_LIMIT);
    if (!matches.length) {
      results.push(
        InlineQueryResultBuilder.article("empty", "Ничего не найдено", {
          description: q,
        }).text(`По запросу «${q}» ничего не найдено.`),
      );
      await ctx.answerInlineQuery(results, { cache_time: 10 });
      return;
    }

    for (const entry of matches) {
      const title = formatTitle(entry);
      const description = formatDescription(entry);
      const thumb = animationPreviewUrl(entry.literal);
      const caption = formatCaption(entry);

      // Article = same UI as the hint (thumb left, title+description right).
      // No MP4 in the suggestion list — Telegram won't preload animations.
      results.push(
        InlineQueryResultBuilder.article(entry.codepoint, title, {
          description,
          thumbnail_url: thumb,
          thumbnail_width: 128,
          thumbnail_height: 128,
          reply_markup: animKeyboard(entry),
        }).text(caption, { parse_mode: "HTML" }),
      );
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 30,
      is_personal: false,
    });
  });

  // One-tap animation if BotFather → Inline Feedback is enabled
  bot.on("chosen_inline_result", async (ctx) => {
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) return;
    const entry = getKanjiByCodepoint(ctx.chosenInlineResult.result_id);
    if (!entry) return;
    try {
      await showAnimation(bot.api, entry, { inlineMessageId });
    } catch (err) {
      console.warn("chosen_inline_result edit failed:", err);
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("anim:")) {
      await ctx.answerCallbackQuery();
      return;
    }

    const entry = getKanjiByCodepoint(data.slice("anim:".length));
    if (!entry) {
      await ctx.answerCallbackQuery({ text: "Кандзи не найден", show_alert: true });
      return;
    }

    try {
      const inlineMessageId = ctx.callbackQuery.inline_message_id;
      if (inlineMessageId) {
        await showAnimation(bot.api, entry, { inlineMessageId });
      } else if (ctx.callbackQuery.message) {
        await showAnimation(bot.api, entry, {
          chatId: ctx.callbackQuery.message.chat.id,
          messageId: ctx.callbackQuery.message.message_id,
        });
      }
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.warn("callback animation failed:", err);
      await ctx.answerCallbackQuery({
        text: "Не удалось загрузить анимацию",
        show_alert: true,
      });
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  return bot;
}
