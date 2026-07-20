import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve project data files both locally and inside Vercel function bundles.
 */
export function resolveDataPath(filename: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(process.cwd(), "data", filename),
    join(here, "..", "data", filename),
    join(here, "..", "..", "data", filename),
    join(here, "data", filename),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    `Missing data/${filename}. Run npm run build:data (and seed:gifs if needed), then redeploy.`,
  );
}
