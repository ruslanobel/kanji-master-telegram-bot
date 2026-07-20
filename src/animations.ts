import { toCodepoint } from "./utils.js";

/**
 * Base CDN URL for stroke animations, without trailing slash.
 * Example: https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@animations-v1/mp4
 */
export function animationsBaseUrl(): string {
  const fromEnv = process.env.ANIMATIONS_CDN_BASE?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return "https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@animations-v1/mp4";
}

export function animationMp4Url(literal: string): string {
  return `${animationsBaseUrl()}/${toCodepoint(literal)}.mp4`;
}
