import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Load .env from project root (not process.cwd()), so IDE/wrong-cwd launches still work. */
export function loadEnv(): void {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = join(root, ".env");
  config({ path: envPath });
  if (!existsSync(envPath) && !process.env.BOT_TOKEN) {
    console.warn(`.env not found at ${envPath}`);
  }
}
