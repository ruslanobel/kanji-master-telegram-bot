import { Bot } from "grammy";
import { loadEnv } from "../src/load-env.js";

loadEnv();

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) throw new Error("BOT_TOKEN missing in .env");
  const bot = new Bot(token);
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  console.log("Webhook removed. Safe to run: npm run dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
