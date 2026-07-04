#!/usr/bin/env bash
# Copies verified installers into the website repo and commits+pushes THAT repo only.
# Usage: publish.sh [--dmg <path>] [--exe <path>]   (pass only what changed)
set -u
cd "$(dirname "$0")/../.." || exit 1
WEBSITE="$(pwd)/fydor-website"

DMG=""
EXE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dmg) DMG="$2"; shift 2 ;;
    --exe) EXE="$2"; shift 2 ;;
    *) echo "FAIL unknown arg $1"; exit 1 ;;
  esac
done

if [ -z "$DMG" ] && [ -z "$EXE" ]; then
  echo "FAIL pass at least one of --dmg or --exe"
  exit 1
fi

STAGE=()
if [ -n "$DMG" ]; then
  [ -f "$DMG" ] || { echo "FAIL dmg not found: $DMG"; exit 1; }
  cp "$DMG" "$WEBSITE/downloads/fydor-mac.dmg"
  STAGE+=(downloads/fydor-mac.dmg)
fi
if [ -n "$EXE" ]; then
  [ -f "$EXE" ] || { echo "FAIL exe not found: $EXE"; exit 1; }
  cp "$EXE" "$WEBSITE/downloads/fydor-windows.exe"
  STAGE+=(downloads/fydor-windows.exe)
fi

cd "$WEBSITE" || exit 1
shasum -a 256 "${STAGE[@]}"
git add "${STAGE[@]}"
git commit -m "Update desktop downloads" >/tmp/fydor-publish.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL git commit failed (see /tmp/fydor-publish.log)"
  exit 1
fi
git push origin main >/tmp/fydor-publish.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL git push failed (see /tmp/fydor-publish.log)"
  exit 1
fi

echo "OK pushed $(git rev-parse --short HEAD): ${STAGE[*]}"
