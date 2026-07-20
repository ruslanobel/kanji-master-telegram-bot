#!/usr/bin/env bash
# Publish / bump stroke animations to a versioned git tag + GitHub Release.
# Usage:
#   ./scripts/publish-animations.sh animations-v1
#   ./scripts/publish-animations.sh animations-v2
set -euo pipefail

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag>   e.g. animations-v1"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MP4_DIR="$ROOT/assets/mp4"

if [[ ! -d "$MP4_DIR" ]] || [[ -z "$(ls -A "$MP4_DIR"/*.mp4 2>/dev/null || true)" ]]; then
  echo "No MP4 files in assets/mp4. Run: npm run build:gifs"
  exit 1
fi

cd "$ROOT"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# Orphan commit containing only mp4/ + attribution (keeps main branch small)
git init -q "$WORK/anim"
cp -R "$MP4_DIR" "$WORK/anim/mp4"
cat > "$WORK/anim/NOTICE.md" <<'EOF'
# Stroke order animations

Derived from [KanjiVG](https://kanjivg.tagaini.net/) © Ulrich Apel, licensed under **CC BY-SA 3.0**.

Served via jsDelivr from this tag, e.g.:

`https://cdn.jsdelivr.net/gh/OWNER/kanji-master-telegram-bot@TAG/mp4/06c34.mp4`
EOF

git -C "$WORK/anim" add mp4 NOTICE.md
git -C "$WORK/anim" -c user.email="noreply@users.noreply.github.com" -c user.name="animations-bot" commit -q -m "chore: stroke animations ${TAG}"
git -C "$WORK/anim" branch -M animations
git -C "$WORK/anim" tag -a "$TAG" -m "Stroke animations ${TAG}"

REMOTE="$(git -C "$ROOT" remote get-url origin)"
git -C "$WORK/anim" remote add origin "$REMOTE"

echo "Pushing branch animations + tag ${TAG}…"
git -C "$WORK/anim" push -f origin animations
git -C "$WORK/anim" push -f origin "refs/tags/${TAG}"

ZIP="$WORK/${TAG}.zip"
( cd "$WORK/anim" && zip -qr "$ZIP" mp4 NOTICE.md )

echo "Creating / updating GitHub Release ${TAG}…"
if gh release view "$TAG" --repo "$(gh repo view --json nameWithOwner -q .nameWithOwner)" >/dev/null 2>&1; then
  gh release upload "$TAG" "$ZIP" --clobber
else
  gh release create "$TAG" "$ZIP" \
    --title "Stroke animations ${TAG}" \
    --notes "$(cat <<EOF
## Stroke order MP4 animations

- **CDN (jsDelivr, pinned tag):** \`https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/mp4/{codepoint}.mp4\`
- Example: https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/mp4/06c34.mp4
- Bulk download: attached \`${TAG}.zip\`
- Source: KanjiVG (CC BY-SA 3.0)

### How to add more animations later

1. \`npm run build:gifs\` (generates new files under \`assets/mp4\`)
2. \`./scripts/publish-animations.sh animations-vN\` (bump N)
3. Set bot env \`ANIMATIONS_CDN_BASE\` to the new tag URL (or update default in code)
EOF
)"
fi

echo "Done. CDN base:"
echo "https://cdn.jsdelivr.net/gh/ruslanobel/kanji-master-telegram-bot@${TAG}/mp4"
