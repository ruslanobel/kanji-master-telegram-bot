import { Bot } from "grammy";
import { loadEnv } from "../src/load-env.js";
import { formatRichMessage } from "../src/format.js";
import { getCachedAnimationFileId } from "../src/gif.js";
import { searchKanji } from "../src/search.js";

loadEnv();

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) throw new Error("no token");
  const bot = new Bot(token);

  const info = await bot.api.getWebhookInfo();
  console.log("webhook", {
    url: info.url,
    pending: info.pending_update_count,
    lastError: info.last_error_message,
    allowed: info.allowed_updates,
  });

  const me = await bot.api.getMe();
  console.log("bot", me.username, "inline", me.supports_inline_queries);

  const chatId = Number(process.argv[2]);
  if (!chatId) {
    console.log("Pass your chat id to smoke sendRichMessage: npx tsx scripts/smoke-dm.ts CHAT_ID");
    return;
  }

  const entry = searchKanji("вода", 1)[0];
  if (!entry) throw new Error("no entry");
  const fileId = getCachedAnimationFileId(entry.literal);
  console.log("sending", entry.literal, "fileId", !!fileId);
  try {
    await bot.api.sendRichMessage(
      chatId,
      formatRichMessage(entry, {
        animation: fileId
          ? { type: "ref", media: fileId }
          : { type: "none" },
      }),
    );
    console.log("sendRichMessage OK");
  } catch (err) {
    console.error("sendRichMessage FAILED", err);
  }
}

main();
