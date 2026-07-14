#!/usr/bin/env bash
# Builds, signs, and packages the macOS DMG. Requires
# FYDOR_MAC_SIGNING_IDENTITY plus Tauri updater signing env vars.
# Prints one final line:
#   OK <path-to-dmg>
# or
#   FAIL <reason>   (see /Users/user/.codex/skills/fydor-release-publisher/references/fydor-release-troubleshooting.md)
set -u
cd "$(dirname "$0")/../.." || exit 1
. scripts/release/env.sh
check_release_env
check_mac_release_env

VERSION=$(node -pe "require('./src-tauri/tauri.conf.json').version")
APP_BUNDLE="src-tauri/target/release/bundle/macos/Fydor.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_OUT="$DMG_DIR/Fydor_${VERSION}_aarch64.dmg"
SIGN_IDENTITY="$FYDOR_MAC_SIGNING_IDENTITY"
export APPLE_SIGNING_IDENTITY="$SIGN_IDENTITY"
RELEASE_CONFIG="$(write_release_config)" || exit 1
DMG_STAGE="$(mktemp -d /private/tmp/fydor-dmg-stage.XXXXXX)"
DMG_MOUNT="$(mktemp -d /private/tmp/fydor-dmg-check.XXXXXX)"
trap 'hdiutil detach "$DMG_MOUNT" >/dev/null 2>&1 || true; rm -rf "$DMG_STAGE" "$DMG_MOUNT"' EXIT

npm run tauri:build -- --bundles app --config "$RELEASE_CONFIG" >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ] || [ ! -d "$APP_BUNDLE" ]; then
  echo "FAIL tauri build did not produce $APP_BUNDLE (see /tmp/fydor-mac-build.log)"
  exit 1
fi

codesign --force --deep --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_BUNDLE" >/tmp/fydor-mac-build.log 2>&1
codesign --verify --deep --strict --verbose=4 "$APP_BUNDLE" >>/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL codesign verify failed on $APP_BUNDLE (see /tmp/fydor-mac-build.log)"
  exit 1
fi

mkdir -p "$DMG_DIR"
ditto "$APP_BUNDLE" "$DMG_STAGE/Fydor.app"
ln -s /Applications "$DMG_STAGE/Applications"
hdiutil create -volname Fydor -srcfolder "$DMG_STAGE" -format UDZO -ov "$DMG_OUT" >/tmp/fydor-mac-build.log 2>&1

if [ ! -f "$DMG_OUT" ]; then
  echo "FAIL DMG not created at $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi

hdiutil verify "$DMG_OUT" >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL hdiutil verify failed on $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi

hdiutil attach "$DMG_OUT" -readonly -nobrowse -mountpoint "$DMG_MOUNT" >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL hdiutil attach failed on $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi
codesign --verify --deep --strict --verbose=4 "$DMG_MOUNT/Fydor.app" >/tmp/fydor-mac-build.log 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL codesign verify failed inside $DMG_OUT (see /tmp/fydor-mac-build.log)"
  exit 1
fi

echo "OK $DMG_OUT"
