#!/usr/bin/env bash
# Publish / bump stroke animations to a versioned git tag + GitHub Release.
# Usage:
#   ./scripts/publish-animations.sh animations-v2
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag>   e.g. animations-v2"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MP4_DIR="$ROOT/assets/mp4"
PREVIEW_DIR="$ROOT/assets/preview"

if [[ ! -d "$MP4_DIR" ]] || [[ -z "$(ls -A "$MP4_DIR"/*.mp4 2>/dev/null || true)" ]]; then
  echo "No MP4 files in assets/mp4. Run: npm run build:gifs"
  exit 1
fi

if [[ ! -d "$PREVIEW_DIR" ]] || [[ -z "$(ls -A "$PREVIEW_DIR"/*.jpg 2>/dev/null || true)" ]]; then
  echo "No JPEG previews in assets/preview. Run: npm run build:previews"
  exit 1
fi

cd "$ROOT"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

git init -q "$WORK/anim"
cp -R "$MP4_DIR" "$WORK/anim/mp4"
cp -R "$PREVIEW_DIR" "$WORK/anim/preview"
cat > "$WORK/anim/NOTICE.md" <<EOF
# Stroke order animations + static previews

Derived from [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, **CC BY-SA 3.0**.

- MP4: \`https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/mp4/{codepoint}.mp4\`
- Preview JPEG: \`https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/preview/{codepoint}.jpg\`
EOF

git -C "$WORK/anim" add mp4 preview NOTICE.md
git -C "$WORK/anim" -c user.email="noreply@users.noreply.github.com" -c user.name="animations-bot" commit -q -m "chore: stroke animations ${TAG}"
git -C "$WORK/anim" branch -M animations
git -C "$WORK/anim" tag -a "$TAG" -m "Stroke animations ${TAG}"

REMOTE="$(git -C "$ROOT" remote get-url origin)"
git -C "$WORK/anim" remote add origin "$REMOTE"

echo "Pushing branch animations + tag ${TAG}…"
git -C "$WORK/anim" push -f origin animations
git -C "$WORK/anim" push -f origin "refs/tags/${TAG}"

ZIP="$WORK/${TAG}.zip"
( cd "$WORK/anim" && zip -qr "$ZIP" mp4 preview NOTICE.md )

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Creating / updating GitHub Release ${TAG}…"
if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "$ZIP" --repo "$REPO" --clobber
else
  gh release create "$TAG" "$ZIP" --repo "$REPO" \
    --title "Stroke animations ${TAG}" \
    --notes "$(cat <<EOF
## Stroke order MP4 + JPEG previews

- **MP4:** \`https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/mp4/{codepoint}.mp4\`
- **Preview:** \`https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/preview/{codepoint}.jpg\`
- Bulk: attached \`${TAG}.zip\`
- Source: KanjiVG (CC BY-SA 3.0)

Inline list uses JPEG previews only; MP4 loads after the user picks a result.
EOF
)"
fi

echo "Done."
echo "CDN root: https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}"
