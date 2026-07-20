import { Bot, InlineQueryResultBuilder } from "grammy";
import { animationMp4Url, animationPreviewUrl } from "./animations.js";
import { formatCaption, formatHelp, formatTitle } from "./format.js";
import { searchKanji } from "./search.js";

const INLINE_LIMIT = 10;

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
      const caption = formatCaption(entry);
      const title = formatTitle(entry);
      const mp4 = animationMp4Url(entry.literal);
      // Static JPEG in the suggestion list — never the MP4 (avoids Telegram crash).
      const thumb = animationPreviewUrl(entry.literal);

      results.push(
        InlineQueryResultBuilder.mpeg4gif(entry.codepoint, mp4, thumb, {
          title,
          caption,
          parse_mode: "HTML",
          mpeg4_width: 200,
          mpeg4_height: 200,
          thumbnail_mime_type: "image/jpeg",
        }),
      );
    }

    await ctx.answerInlineQuery(results, {
      cache_time: 60,
      is_personal: false,
    });
  });

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  return bot;
}
