import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKanjiMp4 } from "./lib/kanji-gif.js";
import { toCodepoint } from "./utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MP4_DIR = join(root, "assets", "mp4");
const FILE_IDS_PATH = join(root, "data", "mp4-file-ids.json");

type FileIdMap = Record<string, string>;

let cachedMap: FileIdMap | null = null;

function loadFileIds(): FileIdMap {
  if (cachedMap) return cachedMap;
  if (!existsSync(FILE_IDS_PATH)) {
    cachedMap = {};
    return cachedMap;
  }
  cachedMap = JSON.parse(readFileSync(FILE_IDS_PATH, "utf8")) as FileIdMap;
  return cachedMap;
}

/** Call after seed finishes if the bot process was already running. */
export function reloadFileIdCache(): void {
  cachedMap = null;
  loadFileIds();
}

export function mp4PathFor(literal: string): string {
  return join(MP4_DIR, `${toCodepoint(literal)}.mp4`);
}

export async function ensureMp4File(literal: string): Promise<string | null> {
  mkdirSync(MP4_DIR, { recursive: true });
  const path = mp4PathFor(literal);
  if (existsSync(path)) return path;
  try {
    await generateKanjiMp4(literal, path);
    return existsSync(path) ? path : null;
  } catch (err) {
    console.error(`MP4 generation failed for ${literal}:`, err);
    return null;
  }
}

/**
 * Only returns file_id from the seed cache.
 * Never uploads/deletes in the user chat during inline search.
 */
export function getCachedAnimationFileId(literal: string): string | null {
  return loadFileIds()[literal] ?? null;
}

/** @deprecated use getCachedAnimationFileId */
export const getAnimationFileId = async (
  _api: unknown,
  literal: string,
  _uploadChatId?: number,
): Promise<string | null> => getCachedAnimationFileId(literal);

export const getGifFileId = getAnimationFileId;
export const ensureGifFile = ensureMp4File;
