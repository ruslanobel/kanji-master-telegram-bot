import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { animationsCdnRoot } from "./animations.js";
import { createBot } from "./bot.js";
import { loadEnv } from "./load-env.js";

loadEnv();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = join(root, "data", "index.json");

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    console.error(
      "BOT_TOKEN is missing. Put it in .env in the project root:\n  BOT_TOKEN=123456:ABC...\nThen run: npm run dev",
    );
    process.exit(1);
  }

  if (!existsSync(INDEX_PATH)) {
    console.error("data/index.json missing. Run: npm run build:data");
    process.exit(1);
  }

  console.log(`Animations CDN: ${animationsCdnRoot()}`);

  const bot = createBot(token);
  console.log("Starting bot (long polling)…");
  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} is running. Try: @${info.username} вода`);
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
