import { Bot } from "grammy";
import { loadEnv } from "../src/load-env.js";

loadEnv();

const ALLOWED_UPDATES = [
  "message",
  "callback_query",
  "inline_query",
  "chosen_inline_result",
] as const;

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) throw new Error("BOT_TOKEN missing in .env");

  const base =
    process.env.WEBHOOK_URL?.trim().replace(/\/$/, "") ||
    process.argv[2]?.replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Pass deployment URL: npm run set-webhook -- https://your-app.vercel.app\n" +
        "Or set WEBHOOK_URL in .env",
    );
  }

  const secret = process.env.WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.warn(
      "Warning: WEBHOOK_SECRET is empty. Set it in .env and Vercel env for production.",
    );
  }

  const url = `${base}/api/bot`;
  const bot = new Bot(token);
  await bot.api.setWebhook(url, {
    secret_token: secret || undefined,
    allowed_updates: [...ALLOWED_UPDATES],
    drop_pending_updates: true,
  });

  const info = await bot.api.getWebhookInfo();
  console.log("Webhook set:", info.url);
  console.log("Pending updates:", info.pending_update_count);
  if (info.last_error_message) {
    console.warn("Last webhook error:", info.last_error_message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
