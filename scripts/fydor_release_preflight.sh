#!/usr/bin/env bash
set -u

APP_REPO="${FYDOR_APP_REPO:-/Users/user/Habitz}"
WEBSITE_REPO="${FYDOR_WEBSITE_REPO:-/Users/user/Habitz/fydor-website}"

print_header() {
  printf '\n== %s ==\n' "$1"
}

cd "$APP_REPO" || exit 1
. scripts/release/env.sh

print_header "Repos"
printf 'App repo:     %s\n' "$APP_REPO"
printf 'Website repo: %s\n' "$WEBSITE_REPO"

if [ -d "$APP_REPO/.git" ]; then
  git -C "$APP_REPO" status --short --branch
else
  printf 'Missing app repo .git directory\n'
fi

if [ -d "$WEBSITE_REPO/.git" ]; then
  git -C "$WEBSITE_REPO" status --short --branch
else
  printf 'Missing website repo .git directory\n'
fi

print_header "Desktop release environment"
printf 'FYDOR_RELEASE_WEB_ORIGIN: %s\n' "$FYDOR_RELEASE_WEB_ORIGIN"
printf 'FYDOR_UPDATER_ENDPOINT:   %s\n' "$FYDOR_UPDATER_ENDPOINT"
if check_release_env; then
  printf 'OK desktop release env has updater signing material and no bundled Supabase/database variables\n'
fi

print_header "Release targets"
printf 'macOS DMG:    %s\n' "$WEBSITE_REPO/downloads/fydor-mac.dmg"
printf 'Windows EXE:  %s\n' "$WEBSITE_REPO/downloads/fydor-windows.exe"
ls -lh "$WEBSITE_REPO/downloads/fydor-mac.dmg" "$WEBSITE_REPO/downloads/fydor-windows.exe" 2>/dev/null || true

print_header "Tools"
for tool in npm cargo rustup cargo-xwin llvm-rc makensis osslsigncode codesign hdiutil shasum file; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '%-12s %s\n' "$tool" "$(command -v "$tool")"
  else
    printf '%-12s MISSING\n' "$tool"
  fi
done

if [ -x /opt/homebrew/bin/makensis ]; then
  printf '%-12s %s\n' "makensis*" "/opt/homebrew/bin/makensis"
fi

print_header "Rust targets"
rustup target list --installed 2>/dev/null || true

print_header "Existing artifact hashes"
if [ -f "$WEBSITE_REPO/downloads/fydor-mac.dmg" ] || [ -f "$WEBSITE_REPO/downloads/fydor-windows.exe" ]; then
  shasum -a 256 "$WEBSITE_REPO/downloads/fydor-mac.dmg" "$WEBSITE_REPO/downloads/fydor-windows.exe" 2>/dev/null || true
fi
