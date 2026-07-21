import {
  Bot,
  type Context,
  GrammyError,
  InlineKeyboard,
  InlineQueryResultBuilder,
} from "grammy";
import { animationPreviewUrl } from "./animations.js";
import {
  formatCaption,
  formatDescription,
  formatRichMessage,
  formatTitle,
  formatWelcome,
} from "./format.js";
import {
  ensureCachedAnimationFileId,
  canAnimate,
  getCachedAnimationFileId,
} from "./gif.js";
import { isServerless } from "./runtime.js";
import { getKanjiByCodepoint, searchKanji } from "./search.js";
import type { KanjiEntry } from "./types.js";

const INLINE_LIMIT = 10;
const DM_LIMIT = 5;
const WARM_BUDGET_MS = 2800;
const WARM_CONCURRENCY = 3;
const WARM_MAX = 5;
const SEARCH_BUTTON = "🔍 Поиск кандзи";

/** Stale inline queries after restart / fast typing — safe to ignore. */
function isStaleInlineQueryError(err: unknown): boolean {
  return (
    err instanceof GrammyError &&
    typeof err.description === "string" &&
    err.description.includes("query is too old")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function articleBase(
  entry: KanjiEntry,
  options: { animationUnavailable?: boolean } = {},
) {
  const base: {
    description: string;
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
  } = {
    description: formatDescription(entry, {
      animationUnavailable: options.animationUnavailable,
    }),
  };
  // Preview only when we have (or can produce) stroke animation assets.
  if (!options.animationUnavailable) {
    base.thumbnail_url = animationPreviewUrl(entry.literal);
    base.thumbnail_width = 128;
    base.thumbnail_height = 128;
  }
  return base;
}

/**
 * Upload missing animations to Telegram so answerInlineQuery can embed file_id
 * (external HTTP media is rejected for inline results).
 */
async function warmFileIds(
  api: Bot["api"],
  entries: KanjiEntry[],
  uploadChatId: number,
): Promise<void> {
  const missing = entries
    .filter(
      (entry) =>
        !getCachedAnimationFileId(entry.literal) && canAnimate(entry.literal),
    )
    .slice(0, WARM_MAX);
  if (!missing.length) return;

  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      const entry = missing[next++]!;
      await ensureCachedAnimationFileId(api, entry.literal, uploadChatId);
    }
  };

  await Promise.race([
    Promise.all(
      Array.from({ length: Math.min(WARM_CONCURRENCY, missing.length) }, () =>
        worker(),
      ),
    ),
    sleep(WARM_BUDGET_MS),
  ]);
}

/**
 * Inject animation after choose/tap.
 * Prefer Telegram file_id; never point Rich Message at a missing CDN MP4.
 */
async function upgradeToFullCard(
  api: Bot["api"],
  entry: KanjiEntry,
  inlineMessageId: string,
  uploadChatId?: number,
): Promise<void> {
  let fileId = getCachedAnimationFileId(entry.literal);
  if (!fileId && uploadChatId && canAnimate(entry.literal)) {
    fileId = await ensureCachedAnimationFileId(api, entry.literal, uploadChatId);
  }

  await api.editMessageTextInline(
    inlineMessageId,
    formatRichMessage(entry, {
      animation: fileId
        ? { type: "ref", media: fileId }
        : { type: "none" },
    }),
    { reply_markup: searchKeyboard() },
  );
}

function buildResults(matches: KanjiEntry[]) {
  return matches.map((entry) => {
    const fileId = getCachedAnimationFileId(entry.literal);
    const unavailable = !fileId && !canAnimate(entry.literal);

    if (fileId) {
      return InlineQueryResultBuilder.article(
        entry.codepoint,
        formatTitle(entry),
        { ...articleBase(entry), reply_markup: searchKeyboard() },
      ).rich(
        formatRichMessage(entry, {
          animation: { type: "ref", media: fileId },
        }),
      );
    }

    // No load button: either warm embeds animation next time, or it's unavailable.
    return InlineQueryResultBuilder.article(
      entry.codepoint,
      formatTitle(entry),
      {
        ...articleBase(entry, { animationUnavailable: unavailable }),
        reply_markup: searchKeyboard(),
      },
    ).rich(
      formatRichMessage(entry, {
        animation: { type: "none" },
        animationUnavailable: unavailable,
      }),
    );
  });
}

async function sendKanjiCard(
  api: Bot["api"],
  chatId: number,
  entry: KanjiEntry,
): Promise<void> {
  const fileId = getCachedAnimationFileId(entry.literal);
  const unavailable = !fileId && !canAnimate(entry.literal);
  const rich = formatRichMessage(entry, {
    animation: fileId
      ? { type: "ref", media: fileId }
      : { type: "none" },
    animationUnavailable: unavailable,
  });
  const reply_markup = searchKeyboard();

  try {
    await api.sendRichMessage(chatId, rich, { reply_markup });
    return;
  } catch (err) {
    console.error("sendRichMessage failed, using fallback:", err);
  }

  // Fallback for clients / API edge cases where Rich Messages fail.
  if (fileId) {
    await api.sendAnimation(chatId, fileId, {
      caption: formatCaption(entry),
      parse_mode: "HTML",
      reply_markup,
    });
    return;
  }
  await api.sendMessage(chatId, formatCaption(entry), {
    parse_mode: "HTML",
    reply_markup,
  });
}

/** Reply with top matches for a text query (DM / /search). */
async function replySearchResults(
  bot: Bot,
  ctx: Context,
  query: string,
  seedChatId: number | undefined,
): Promise<void> {
  if (!ctx.chat) return;

  const matches = searchKanji(query, DM_LIMIT);
  if (!matches.length) {
    await ctx.reply(`По запросу «${query}» ничего не найдено.`);
    return;
  }

  const uploadChatId = seedChatId ?? ctx.from?.id;
  if (!isServerless() && uploadChatId) {
    await warmFileIds(bot.api, matches, uploadChatId);
  }

  await sendKanjiCard(bot.api, ctx.chat.id, matches[0]!);

  if (matches.length > 1) {
    const username = ctx.me.username ?? "bot";
    const lines = matches.slice(1).map((e) => `• ${formatTitle(e)}`);
    await ctx.reply(
      `Ещё варианты:\n${lines.join("\n")}\n\nВ другом чате: @${username} ${query}`,
      { reply_markup: searchKeyboard() },
    );
  }
}

function searchKeyboard(): InlineKeyboard {
  return new InlineKeyboard().switchInlineCurrent(SEARCH_BUTTON, "");
}

function welcomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .switchInlineCurrent(SEARCH_BUTTON, "")
    .row()
    .switchInline("Попробовать в другом чате", "");
}

const BOT_COMMANDS = [
  { command: "start", description: "Справка и кнопка поиска" },
  { command: "help", description: "Как пользоваться" },
] as const;

async function sendWelcome(ctx: Context): Promise<void> {
  await ctx.reply(formatWelcome(), {
    reply_markup: welcomeKeyboard(),
  });
}

export function createBot(token: string): Bot {
  const bot = new Bot(token);
  const seedChatId = Number(process.env.UPLOAD_CHAT_ID) || undefined;
  let metaReady = false;

  void bot.api.setMyCommands([...BOT_COMMANDS]).catch((err) => {
    console.warn("setMyCommands failed:", err);
  });

  // Restore command menu (≡); clear any previous MenuButtonWebApp.
  void bot.api
    .setChatMenuButton({ menu_button: { type: "commands" } })
    .catch((err) => {
      console.warn("setChatMenuButton failed:", err);
    });

  bot.use(async (_ctx, next) => {
    if (!metaReady) {
      metaReady = true;
      try {
        await bot.api.setMyCommands([...BOT_COMMANDS]);
        await bot.api.setChatMenuButton({ menu_button: { type: "commands" } });
        // Do not call setMyDescription / setMyShortDescription —
        // those are managed manually in BotFather / bot settings.
      } catch (err) {
        console.warn("setMy* meta failed:", err);
      }
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await sendWelcome(ctx);
  });

  bot.command("help", async (ctx) => {
    await sendWelcome(ctx);
  });

  // Welcome when the bot is added to a group / supergroup.
  bot.on("my_chat_member", async (ctx) => {
    const { old_chat_member: prev, new_chat_member: next } = ctx.myChatMember;
    const wasOut = prev.status === "left" || prev.status === "kicked";
    const isIn =
      next.status === "member" || next.status === "administrator";
    if (!wasOut || !isIn) return;
    try {
      await sendWelcome(ctx);
    } catch (err) {
      console.error("welcome on join failed:", err);
    }
  });

  // Private chat: send a query without @bot.
  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private") return;
    const text = ctx.message.text.trim();
    if (!text || text.startsWith("/")) return;

    try {
      await replySearchResults(bot, ctx, text, seedChatId);
    } catch (err) {
      console.error("DM search failed:", err);
      try {
        await ctx.reply(
          "Не удалось обработать запрос. Попробуй кнопку «Поиск кандзи».",
          { reply_markup: searchKeyboard() },
        );
      } catch {
        // ignore
      }
    }
  });

  bot.on("inline_query", async (ctx) => {
    try {
      const q = ctx.inlineQuery.query.trim();

      if (!q) {
        await ctx.answerInlineQuery(
          [
            InlineQueryResultBuilder.article("hint", "Введите запрос", {
              description: "кандзи, чтение (みず) или перевод (вода)",
            }).text(
              "Введите кандзи, он/кун чтение или русский перевод после @бота.",
            ),
          ],
          { cache_time: 0, is_personal: true },
        );
        return;
      }

      const matches = searchKanji(q, INLINE_LIMIT);
      if (!matches.length) {
        await ctx.answerInlineQuery(
          [
            InlineQueryResultBuilder.article("empty", "Ничего не найдено", {
              description: q,
            }).text(`По запросу «${q}» ничего не найдено.`),
          ],
          { cache_time: 0, is_personal: true },
        );
        return;
      }

      const uploadChatId = seedChatId ?? ctx.from.id;
      if (!isServerless()) {
        await warmFileIds(bot.api, matches, uploadChatId);
      }

      await ctx.answerInlineQuery(buildResults(matches), {
        cache_time: 0,
        is_personal: true,
      });
    } catch (err) {
      if (isStaleInlineQueryError(err)) return;
      throw err;
    }
  });

  bot.on("chosen_inline_result", async (ctx) => {
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) return;
    const entry = getKanjiByCodepoint(ctx.chosenInlineResult.result_id);
    if (!entry) return;
    try {
      await upgradeToFullCard(
        bot.api,
        entry,
        inlineMessageId,
        seedChatId ?? ctx.from.id,
      );
    } catch (err) {
      console.warn("chosen_inline_result rich upgrade failed:", err);
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (!data.startsWith("k:")) {
      await ctx.answerCallbackQuery();
      return;
    }

    const entry = getKanjiByCodepoint(data.slice(2));
    if (!entry) {
      await ctx.answerCallbackQuery({ text: "Кандзи не найден", show_alert: true });
      return;
    }

    try {
      const inlineMessageId = ctx.callbackQuery.inline_message_id;
      if (inlineMessageId) {
        await upgradeToFullCard(
          bot.api,
          entry,
          inlineMessageId,
          seedChatId ?? ctx.from.id,
        );
      }
      await ctx.answerCallbackQuery();
    } catch (err) {
      console.warn("callback rich upgrade failed:", err);
      await ctx.answerCallbackQuery({
        text: "Не удалось загрузить карточку",
        show_alert: true,
      });
    }
  });

  bot.catch((err) => {
    if (isStaleInlineQueryError(err.error)) return;
    console.error("Bot error:", err.error);
  });

  return bot;
}
