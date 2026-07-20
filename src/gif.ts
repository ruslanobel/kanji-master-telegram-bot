import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InputFile, type Api } from "grammy";
import { hasKanjiVg } from "./lib/kanjivg-path.js";
import { isServerless } from "./runtime.js";
import { toCodepoint } from "./utils.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MP4_DIR = join(root, "assets", "mp4");

type FileIdMap = Record<string, string>;

let cachedMap: FileIdMap | null = null;
const inflight = new Map<string, Promise<string | null>>();
const missingAnim = new Set<string>();

function fileIdCandidates(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    join(process.cwd(), "data", "mp4-file-ids.json"),
    join(here, "..", "data", "mp4-file-ids.json"),
    join(here, "..", "..", "data", "mp4-file-ids.json"),
  ];
}

function loadFileIds(): FileIdMap {
  if (cachedMap) return cachedMap;
  for (const path of fileIdCandidates()) {
    if (!existsSync(path)) continue;
    cachedMap = JSON.parse(readFileSync(path, "utf8")) as FileIdMap;
    return cachedMap;
  }
  cachedMap = {};
  return cachedMap;
}

function saveFileIds(map: FileIdMap): void {
  cachedMap = map;
  if (isServerless()) return;
  const path = fileIdCandidates()[1]!;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(map, null, 2)}\n`, "utf8");
  } catch (err) {
    console.warn("saveFileIds failed:", err);
  }
}

/** Call after seed finishes if the bot process was already running. */
export function reloadFileIdCache(): void {
  cachedMap = null;
  loadFileIds();
}

export function mp4PathFor(literal: string): string {
  return join(MP4_DIR, `${toCodepoint(literal)}.mp4`);
}

export function hasLocalMp4(literal: string): boolean {
  return existsSync(mp4PathFor(literal));
}

/** Animation available via Telegram file_id, local MP4, or (dev) KanjiVG. */
export function canAnimate(literal: string): boolean {
  if (getCachedAnimationFileId(literal)) return true;
  if (isServerless()) return false;
  if (missingAnim.has(literal)) return false;
  if (hasLocalMp4(literal)) return true;
  return hasKanjiVg(literal);
}

export async function ensureMp4File(literal: string): Promise<string | null> {
  if (isServerless()) return hasLocalMp4(literal) ? mp4PathFor(literal) : null;
  if (missingAnim.has(literal)) return null;
  mkdirSync(MP4_DIR, { recursive: true });
  const path = mp4PathFor(literal);
  if (existsSync(path)) return path;
  if (!hasKanjiVg(literal)) {
    missingAnim.add(literal);
    return null;
  }
  try {
    const { generateKanjiMp4 } = await import("./lib/kanji-gif.js");
    await generateKanjiMp4(literal, path);
    return existsSync(path) ? path : null;
  } catch (err) {
    missingAnim.add(literal);
    console.warn(
      `MP4 skipped for ${literal}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function getCachedAnimationFileId(literal: string): string | null {
  return loadFileIds()[literal] ?? null;
}

export async function ensureCachedAnimationFileId(
  api: Api,
  literal: string,
  uploadChatId: number,
): Promise<string | null> {
  const existing = getCachedAnimationFileId(literal);
  if (existing) return existing;
  if (isServerless() || !canAnimate(literal)) return null;

  const pending = inflight.get(literal);
  if (pending) return pending;

  const task = (async (): Promise<string | null> => {
    const path = await ensureMp4File(literal);
    if (!path) return null;
    try {
      const msg = await api.sendAnimation(uploadChatId, new InputFile(path));
      const fileId = msg.animation?.file_id;
      if (!fileId) return null;
      const map = loadFileIds();
      map[literal] = fileId;
      saveFileIds(map);
      try {
        await api.deleteMessage(uploadChatId, msg.message_id);
      } catch {
        // ignore
      }
      return fileId;
    } catch (err) {
      console.warn(`ensureCachedAnimationFileId(${literal}) failed:`, err);
      return null;
    } finally {
      inflight.delete(literal);
    }
  })();

  inflight.set(literal, task);
  return task;
}

/** @deprecated use getCachedAnimationFileId */
export const getAnimationFileId = async (
  _api: unknown,
  literal: string,
  _uploadChatId?: number,
): Promise<string | null> => getCachedAnimationFileId(literal);

export const getGifFileId = getAnimationFileId;
export const ensureGifFile = ensureMp4File;
