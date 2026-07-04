#!/usr/bin/env bash
# Builds, signs, and packages the macOS DMG. Prints one final line:
#   OK <path-to-dmg>
# or
#   FAIL <reason>   (see .codex/skills/fydor-release-publisher/references/fydor-release-troubleshooting.md)
set -u
cd "$(dirname "$0")/../.." || exit 1

VERSION=$(node -pe "require('./src-tauri/tauri.conf.json').version")
APP_BUNDLE="src-tauri/target/release/bundle/macos/Fydor.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_OUT="$DMG_DIR/Fydor_${VERSION}_aarch64.dmg"

npm run tauri:build -- --bundles app >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ] || [ ! -d "$APP_BUNDLE" ]; then
  echo "FAIL tauri build did not produce $APP_BUNDLE (see /tmp/fydor-mac-build.log)"
  exit 1
fi

codesign --force --deep --sign - "$APP_BUNDLE" >/tmp/fydor-mac-build.log 2>&1
codesign --verify --deep --strict --verbose=4 "$APP_BUNDLE" >>/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL codesign verify failed on $APP_BUNDLE (see /tmp/fydor-mac-build.log)"
  exit 1
fi

mkdir -p "$DMG_DIR"
(
  cd src-tauri/target/release/bundle/macos &&
  ../dmg/bundle_dmg.sh --skip-jenkins --volname Fydor --icon Fydor.app 180 170 \
    --app-drop-link 480 170 --window-size 660 400 --hide-extension Fydor.app \
    --volicon "$(pwd)/../dmg/icon.icns" "$(pwd)/../dmg/Fydor_${VERSION}_aarch64.dmg" Fydor.app
) >/tmp/fydor-mac-build.log 2>&1

if [ ! -f "$DMG_OUT" ]; then
  echo "FAIL DMG not created at $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi

hdiutil verify "$DMG_OUT" >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL hdiutil verify failed on $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi

echo "OK $DMG_OUT"
