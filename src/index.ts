import { animationsCdnRoot } from "./animations.js";
import { createBot } from "./bot.js";
import { loadEnv } from "./load-env.js";
import { resolveDataPath } from "./paths.js";

loadEnv();

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    console.error(
      "BOT_TOKEN is missing. Put it in .env in the project root:\n  BOT_TOKEN=123456:ABC...\nThen run: npm run dev",
    );
    process.exit(1);
  }

  try {
    resolveDataPath("index.json");
  } catch {
    console.error("data/index.json missing. Run: npm run build:data");
    process.exit(1);
  }

  console.log(`Animations CDN: ${animationsCdnRoot()}`);

  const bot = createBot(token);
  console.log("Starting bot (long polling)…");
  console.log("If you deployed to Vercel, run: npm run delete-webhook");
  await bot.start({
    drop_pending_updates: true,
    allowed_updates: [
      "message",
      "callback_query",
      "inline_query",
      "chosen_inline_result",
    ],
    onStart: (info) => {
      console.log(`Bot @${info.username} is running. Try: @${info.username} вода`);
      console.log(
        "Tip: BotFather → /setinlinefeedback → Enabled (100%) for auto-animation without a button.",
      );
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
