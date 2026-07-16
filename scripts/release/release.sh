#!/usr/bin/env bash
# One-shot release pipeline: checks ALL tool prerequisites for both platforms
# up front, then builds Mac + Windows sequentially.
#
# Usage:
#   scripts/release/release.sh              # build both, print artifact paths
#   scripts/release/release.sh --mac-only | --windows-only
set -u
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/opt/llvm/bin:/opt/homebrew/bin:$PATH"
. scripts/release/env.sh

DO_MAC=1
DO_WIN=1
for arg in "$@"; do
  case "$arg" in
    --mac-only) DO_WIN=0 ;;
    --windows-only) DO_MAC=0 ;;
    *) echo "FAIL unknown arg $arg"; exit 1 ;;
  esac
done

echo "== Checking prerequisites =="
check_release_env
echo "desktop release origin: $FYDOR_RELEASE_WEB_ORIGIN"
echo "updater endpoint: $FYDOR_UPDATER_ENDPOINT"
MISSING=0
if [ "$DO_MAC" = 1 ]; then
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

MAC_RESULT=""
WIN_RESULT=""

if [ "$DO_MAC" = 1 ]; then
  echo "== building macOS DMG (this takes a few minutes) =="
  MAC_RESULT="$(scripts/release/build-mac.sh)"
  echo "$MAC_RESULT"
fi

if [ "$DO_WIN" = 1 ]; then
  echo "== building Windows EXE (this takes longer on first run) =="
  WIN_RESULT="$(scripts/release/build-windows.sh)"
  echo "$WIN_RESULT"
fi
