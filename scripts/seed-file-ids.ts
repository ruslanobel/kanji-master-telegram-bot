import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Bot, GrammyError, HttpError, InputFile } from "grammy";
import { loadEnv } from "../src/load-env.js";

loadEnv();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MP4_DIR = join(root, "assets", "mp4");
const FILE_IDS_PATH = join(root, "data", "mp4-file-ids.json");
const DELAY_MS = 450;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterSeconds(err: unknown): number | null {
  if (err instanceof GrammyError && err.error_code === 429) {
    const params = err.parameters as { retry_after?: number } | undefined;
    if (typeof params?.retry_after === "number") return params.retry_after;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = /retry after (\d+)/i.exec(msg);
  return m ? Number(m[1]) : null;
}

async function main(): Promise<void> {
  const token = process.env.BOT_TOKEN?.trim();
  const chatId = Number(process.env.UPLOAD_CHAT_ID);
  if (!token) throw new Error("BOT_TOKEN is required (set it in .env)");
  if (!chatId) throw new Error("UPLOAD_CHAT_ID is required");

  if (!existsSync(MP4_DIR)) {
    throw new Error("assets/mp4 missing. Run npm run build:gifs first.");
  }

  const bot = new Bot(token);
  mkdirSync(dirname(FILE_IDS_PATH), { recursive: true });

  const map: Record<string, string> = existsSync(FILE_IDS_PATH)
    ? (JSON.parse(readFileSync(FILE_IDS_PATH, "utf8")) as Record<string, string>)
    : {};

  const files = readdirSync(MP4_DIR).filter((f) => f.endsWith(".mp4"));
  const pending = files.filter((file) => {
    const hex = file.replace(/\.mp4$/, "");
    const literal = String.fromCodePoint(Number.parseInt(hex, 16));
    return !map[literal];
  });

  const keepMessages = process.env.SEED_KEEP_MESSAGES === "1";

  console.log(
    `Seeding ${pending.length} MP4 (${Object.keys(map).length} already cached)…`,
  );
  console.log("Можно прервать Ctrl+C и продолжить позже — прогресс в data/mp4-file-ids.json");
  if (!keepMessages) {
    console.log(
      "Служебные сообщения после загрузки удаляются (чтобы не засорять чат). Оставить: SEED_KEEP_MESSAGES=1",
    );
  }

  let uploaded = 0;
  for (const [i, file] of pending.entries()) {
    const hex = file.replace(/\.mp4$/, "");
    const literal = String.fromCodePoint(Number.parseInt(hex, 16));
    const path = join(MP4_DIR, file);

    let attempts = 0;
    while (attempts < 8) {
      attempts++;
      try {
        const msg = await bot.api.sendAnimation(chatId, new InputFile(path), {
          caption: literal,
        });
        const fileId = msg.animation?.file_id;
        if (!fileId) throw new Error("no animation.file_id (Telegram treated file as document?)");
        map[literal] = fileId;
        uploaded++;
        if (!keepMessages) {
          try {
            await bot.api.deleteMessage(chatId, msg.message_id);
          } catch {
            // ignore
          }
        }
        await sleep(DELAY_MS);
        break;
      } catch (err) {
        if (err instanceof HttpError) {
          console.warn(`Network error ${literal}, wait 5s…`);
          await sleep(5000);
          continue;
        }
        const wait = retryAfterSeconds(err);
        if (wait !== null) {
          console.warn(`Rate limit on ${literal}, sleep ${wait + 1}s…`);
          await sleep((wait + 1) * 1000);
          continue;
        }
        console.warn(`Failed ${literal}:`, err instanceof Error ? err.message : err);
        await sleep(2000);
        break;
      }
    }

    if ((i + 1) % 20 === 0 || i === pending.length - 1) {
      writeFileSync(FILE_IDS_PATH, JSON.stringify(map, null, 2) + "\n");
      console.log(
        `Progress ${i + 1}/${pending.length}, uploaded this run=${uploaded}, total=${Object.keys(map).length}`,
      );
    }
  }

  writeFileSync(FILE_IDS_PATH, JSON.stringify(map, null, 2) + "\n");
  console.log(`Done. file_ids=${Object.keys(map).length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
