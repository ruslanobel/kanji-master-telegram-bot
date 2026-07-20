import { toCodepoint } from "./utils.js";

const DEFAULT_TAG = "animations-v2";
const DEFAULT_REPO = "ruslanobel/kanji-master-telegram-bot";

/** Root CDN for a tag, e.g. .../@animations-v2  (no trailing slash, no /mp4) */
export function animationsCdnRoot(): string {
  const fromEnv = process.env.ANIMATIONS_CDN_ROOT?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return `https://cdn.jsdelivr.net/gh/${DEFAULT_REPO}@${DEFAULT_TAG}`;
}

export function animationMp4Url(literal: string): string {
  const base = process.env.ANIMATIONS_CDN_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${toCodepoint(literal)}.mp4`;
  return `${animationsCdnRoot()}/mp4/${toCodepoint(literal)}.mp4`;
}

/** Static JPEG for inline result list (must NOT be the MP4). */
export function animationPreviewUrl(literal: string): string {
  const base = process.env.ANIMATIONS_PREVIEW_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${toCodepoint(literal)}.jpg`;
  return `${animationsCdnRoot()}/preview/${toCodepoint(literal)}.jpg`;
}
