import { webhookCallback } from "grammy";
import { createBot } from "../src/bot.js";

const token = process.env.BOT_TOKEN?.trim();
if (!token) {
  throw new Error("BOT_TOKEN is unset");
}

const bot = createBot(token);

const secret = process.env.WEBHOOK_SECRET?.trim();

/**
 * Vercel Node serverless entry (Telegram webhook).
 * @see https://grammy.dev/hosting/vercel
 */
export default webhookCallback(bot, "https", {
  onTimeout: "return",
  timeoutMilliseconds: 55_000,
  secretToken: secret || undefined,
});
