import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const KANJIVG_DIR = join(root, "assets", "kanjivg");
const KANJIVG_URL =
  "https://github.com/KanjiVG/kanjivg/releases/download/r20220427/kanjivg-20220427-all.zip";

const SIZE = 200;
const FPS = 10;
const STROKE_FRAMES = 4;
const PAUSE_FRAMES = 1;
const END_HOLD_FRAMES = 8;

function codepointHex(literal: string): string {
  return literal.codePointAt(0)!.toString(16).padStart(5, "0");
}

export async function ensureKanjiVg(): Promise<string> {
  mkdirSync(KANJIVG_DIR, { recursive: true });
  const marker = join(KANJIVG_DIR, ".ready");
  if (existsSync(marker)) return KANJIVG_DIR;

  const zipPath = join(KANJIVG_DIR, "kanjivg.zip");
  if (!existsSync(zipPath)) {
    console.log("Downloading KanjiVG…");
    const res = await fetch(KANJIVG_URL);
    if (!res.ok) throw new Error(`KanjiVG download failed: ${res.status}`);
    writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
  }

  console.log("Extracting KanjiVG (this may take a minute)…");
  execFileSync("unzip", ["-q", "-o", zipPath, "-d", KANJIVG_DIR], { stdio: "inherit" });
  writeFileSync(marker, "ok\n");
  return KANJIVG_DIR;
}

function findSvgPath(literal: string): string | null {
  const hex = codepointHex(literal);
  for (const p of [join(KANJIVG_DIR, "kanji", `${hex}.svg`), join(KANJIVG_DIR, `${hex}.svg`)]) {
    if (existsSync(p)) return p;
  }
  return null;
}

type Stroke = { d: string };

function extractStrokes(svg: string): Stroke[] {
  const strokes: { n: number; d: string }[] = [];
  const pathRe = /<path\b([^>]*?)\/?>/gi;
  let match: RegExpExecArray | null;
  while ((match = pathRe.exec(svg))) {
    const attrs = match[1];
    const idMatch = /\bid="(kvg:[^"]+)"/i.exec(attrs);
    if (!idMatch) continue;
    const strokeMatch = /-s(\d+)$/i.exec(idMatch[1]);
    if (!strokeMatch) continue;
    const dMatch = /\bd="([^"]+)"/.exec(attrs);
    if (!dMatch) continue;
    strokes.push({ n: Number(strokeMatch[1]), d: dMatch[1] });
  }
  strokes.sort((a, b) => a.n - b.n);
  return strokes.map((s) => ({ d: s.d }));
}

function buildFrameSvg(strokes: Stroke[], drawn: number, partial: number): string {
  const guide = strokes
    .map(
      (s) =>
        `<path d="${s.d}" fill="none" stroke="#dddddd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const full = strokes
    .slice(0, drawn)
    .map(
      (s) =>
        `<path d="${s.d}" fill="none" stroke="#000000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  let current = "";
  if (drawn < strokes.length && partial > 0) {
    const s = strokes[drawn];
    current = `<path d="${s.d}" fill="none" stroke="#000000" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" pathLength="100" stroke-dasharray="${partial} ${100 - partial}"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 109 109">
  <rect width="109" height="109" fill="#ffffff"/>
  ${guide}
  ${full}
  ${current}
</svg>`;
}

async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(SIZE, SIZE, { fit: "fill" }).png().toBuffer();
}

async function svgToJpeg(svg: string, size = 128): Promise<Buffer> {
  // Telegram inline thumbnails need baseline JPEG (not progressive).
  return sharp(Buffer.from(svg))
    .resize(size, size, { fit: "fill" })
    .jpeg({ quality: 85, progressive: false, optimizeScans: false })
    .toBuffer();
}

/** Static JPEG preview (final glyph) for inline result thumbnails. */
export async function generateKanjiPreview(literal: string, outPath: string): Promise<void> {
  await ensureKanjiVg();
  const svgPath = findSvgPath(literal);
  if (!svgPath) throw new Error(`No KanjiVG SVG for ${literal}`);

  const strokes = extractStrokes(readFileSync(svgPath, "utf8"));
  if (strokes.length === 0) throw new Error(`No strokes found for ${literal}`);

  const jpeg = await svgToJpeg(buildFrameSvg(strokes, strokes.length, 0));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, jpeg);
}

function requireFfmpeg(): string {
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not found");
  return ffmpegPath;
}

/** Encode silent H.264 MP4 (Telegram animation / mpeg4_gif). */
export async function generateKanjiMp4(literal: string, outPath: string): Promise<void> {
  await ensureKanjiVg();
  const svgPath = findSvgPath(literal);
  if (!svgPath) throw new Error(`No KanjiVG SVG for ${literal}`);

  const strokes = extractStrokes(readFileSync(svgPath, "utf8"));
  if (strokes.length === 0) throw new Error(`No strokes found for ${literal}`);

  const frameDir = mkdtempSync(join(tmpdir(), "kanji-mp4-"));
  try {
    let frameIndex = 0;
    const writeFrame = async (svg: string) => {
      frameIndex++;
      const name = `frame-${String(frameIndex).padStart(4, "0")}.png`;
      writeFileSync(join(frameDir, name), await svgToPng(svg));
    };

    for (let i = 0; i < strokes.length; i++) {
      for (let f = 1; f <= STROKE_FRAMES; f++) {
        const partial = Math.round((f / STROKE_FRAMES) * 100);
        await writeFrame(buildFrameSvg(strokes, i, partial));
      }
      for (let p = 0; p < PAUSE_FRAMES; p++) {
        await writeFrame(buildFrameSvg(strokes, i + 1, 0));
      }
    }
    for (let p = 0; p < END_HOLD_FRAMES; p++) {
      await writeFrame(buildFrameSvg(strokes, strokes.length, 0));
    }

    mkdirSync(dirname(outPath), { recursive: true });
    execFileSync(
      requireFfmpeg(),
      [
        "-y",
        "-framerate",
        String(FPS),
        "-i",
        join(frameDir, "frame-%04d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        "-movflags",
        "+faststart",
        "-crf",
        "23",
        outPath,
      ],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(frameDir, { recursive: true, force: true });
  }
}

/** @deprecated alias */
export const generateKanjiGif = generateKanjiMp4;
