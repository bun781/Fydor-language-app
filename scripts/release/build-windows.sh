#!/usr/bin/env bash
# Cross-compiles the Windows binary and bundles it with NSIS for direct website distribution.
# Prints one final line:
#   OK <path-to-exe>
# or
#   FAIL <reason>   (see .codex/skills/fydor-release-publisher/references/fydor-release-troubleshooting.md)
set -u
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/opt/llvm/bin:/opt/homebrew/bin:$PATH"
. scripts/release/env.sh
check_release_env

TARGET="x86_64-pc-windows-msvc"
RELEASE_CONFIG="$(write_release_config)" || exit 1
for tool in cargo-xwin llvm-rc makensis; do
  if ! command -v "$tool" >/dev/null 2>&1 && [ ! -x "/opt/homebrew/bin/$tool" ]; then
    echo "FAIL missing required tool: $tool"
    exit 1
  fi
done
if ! rustup target list --installed | grep -q "$TARGET"; then
  echo "FAIL missing rust target: $TARGET"
  exit 1
fi

(cd src-tauri && cargo xwin build --release --target "$TARGET") >/tmp/fydor-win-build.log 2>&1
BIN="src-tauri/target/$TARGET/release/fydor.exe"
if [ $? -ne 0 ] || [ ! -f "$BIN" ]; then
  echo "FAIL cargo xwin build did not produce $BIN (see /tmp/fydor-win-build.log)"
  exit 1
fi

NSIS_DIR="src-tauri/target/$TARGET/release/nsis/x64"
if [ ! -f "$NSIS_DIR/installer.nsi" ]; then
  # First build on this machine: scaffold the NSIS script via a Tauri build that
  # will fail at the (already-compiled) binary step but still generate installer.nsi.
  npm run tauri -- build --target "$TARGET" --bundles nsis --config "$RELEASE_CONFIG" >/tmp/fydor-win-build.log 2>&1
fi
if [ ! -f "$NSIS_DIR/installer.nsi" ]; then
  echo "FAIL no installer.nsi at $NSIS_DIR (see /tmp/fydor-win-build.log)"
  exit 1
fi

(cd "$NSIS_DIR" && "$(command -v makensis || echo /opt/homebrew/bin/makensis)" installer.nsi) >/tmp/fydor-win-build.log 2>&1
EXE="$NSIS_DIR/nsis-output.exe"
if [ $? -ne 0 ] || [ ! -f "$EXE" ]; then
  echo "FAIL makensis did not produce $EXE (see /tmp/fydor-win-build.log)"
  exit 1
fi

if ! file "$EXE" | grep -q "Nullsoft Installer"; then
  echo "FAIL $EXE is not a Nullsoft installer"
  exit 1
fi

echo "OK $EXE"
