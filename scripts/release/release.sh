#!/usr/bin/env bash
# One-shot release pipeline: builds installers and copies them into the website's
# static public/downloads directory.
#
# Usage:
#   scripts/release/release.sh --publish    # build, stage, commit, and push both installers
#   scripts/release/release.sh --publish --mac-only | --windows-only
#   scripts/release/release.sh --publish --use-existing  # publish already verified installers
set -u
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/opt/llvm/bin:/opt/homebrew/bin:$PATH"
. scripts/release/env.sh

DO_MAC=1
DO_WIN=1
PUBLISH=0
USE_EXISTING=0
for arg in "$@"; do
  case "$arg" in
    --mac-only) DO_WIN=0 ;;
    --windows-only) DO_MAC=0 ;;
    --publish) PUBLISH=1 ;;
    --use-existing) USE_EXISTING=1 ;;
    *) echo "FAIL unknown arg $arg"; exit 1 ;;
  esac
done

echo "== Checking prerequisites =="
check_release_env
echo "desktop release origin: $FYDOR_RELEASE_WEB_ORIGIN"
MISSING=0
if [ "$DO_MAC" = 1 ] && [ "$USE_EXISTING" = 0 ]; then
  for tool in hdiutil; do
    command -v "$tool" >/dev/null 2>&1 || { echo "missing (mac): $tool"; MISSING=1; }
  done
fi
if [ "$DO_WIN" = 1 ]; then
  for tool in cargo-xwin llvm-rc makensis; do
    command -v "$tool" >/dev/null 2>&1 || [ -x "/opt/homebrew/bin/$tool" ] || { echo "missing (windows): $tool"; MISSING=1; }
  done
  rustup target list --installed | grep -q x86_64-pc-windows-msvc || { echo "missing (windows): rust target x86_64-pc-windows-msvc"; MISSING=1; }
fi

if [ "$MISSING" = 1 ]; then
  echo "FAIL prerequisites missing, aborting before any build (see references/fydor-release-troubleshooting.md)"
  exit 1
fi
echo "all tools present"

echo "== typecheck + test =="
npm run typecheck >/tmp/fydor-release.log 2>&1 && npm test >>/tmp/fydor-release.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL typecheck/test failed (see /tmp/fydor-release.log)"
  exit 1
fi
echo "OK"

VERSION="$(node -pe "require('./src-tauri/tauri.conf.json').version")"
MAC_PATH="src-tauri/target/release/bundle/dmg/Fydor_${VERSION}_aarch64.dmg"
WIN_PATH="src-tauri/target/x86_64-pc-windows-msvc/release/nsis/x64/nsis-output.exe"

if [ "$DO_MAC" = 1 ] && [ "$USE_EXISTING" = 0 ]; then
  echo "== building macOS DMG (this takes a few minutes) =="
  scripts/release/build-mac.sh
  if [ ! -f "$MAC_PATH" ]; then
    echo "FAIL macOS build did not produce $MAC_PATH"
    exit 1
  fi
  echo "OK $MAC_PATH"
fi

if [ "$DO_WIN" = 1 ] && [ "$USE_EXISTING" = 0 ]; then
  echo "== building Windows EXE (this takes longer on first run) =="
  scripts/release/build-windows.sh
  if [ ! -f "$WIN_PATH" ]; then
    echo "FAIL Windows build did not produce $WIN_PATH"
    exit 1
  fi
  echo "OK $WIN_PATH"
fi

if [ "$DO_MAC" = 1 ] && [ ! -f "$MAC_PATH" ]; then
  echo "FAIL macOS installer not found at $MAC_PATH"
  exit 1
fi
if [ "$DO_WIN" = 1 ] && [ ! -f "$WIN_PATH" ]; then
  echo "FAIL Windows installer not found at $WIN_PATH"
  exit 1
fi

WEBSITE_DIR="$PWD/fydor-website"
mkdir -p "$WEBSITE_DIR/public/downloads" "$WEBSITE_DIR/downloads"

if [ "$DO_MAC" = 1 ]; then
  cp "$MAC_PATH" "$WEBSITE_DIR/public/downloads/fydor-mac-v$VERSION.dmg"
  cp "$MAC_PATH" "$WEBSITE_DIR/downloads/fydor-mac-v$VERSION.dmg"
  cp "$MAC_PATH" "$WEBSITE_DIR/public/downloads/fydor-mac.dmg"
  cp "$MAC_PATH" "$WEBSITE_DIR/downloads/fydor-mac.dmg"
  shasum -a 256 "$WEBSITE_DIR/public/downloads/fydor-mac-v$VERSION.dmg"
fi

if [ "$DO_WIN" = 1 ]; then
  cp "$WIN_PATH" "$WEBSITE_DIR/public/downloads/fydor-windows-v$VERSION.exe"
  cp "$WIN_PATH" "$WEBSITE_DIR/downloads/fydor-windows-v$VERSION.exe"
  cp "$WIN_PATH" "$WEBSITE_DIR/public/downloads/fydor-windows.exe"
  cp "$WIN_PATH" "$WEBSITE_DIR/downloads/fydor-windows.exe"
  shasum -a 256 "$WEBSITE_DIR/public/downloads/fydor-windows-v$VERSION.exe"
fi

if [ "$PUBLISH" = 1 ]; then
  git -C "$WEBSITE_DIR" add public/downloads downloads app/page.tsx components/download-link.tsx
  git -C "$WEBSITE_DIR" commit -m "release: desktop v$VERSION"
  git -C "$WEBSITE_DIR" push
  echo "OK website release v$VERSION published"
fi
