#!/usr/bin/env bash
set -u

FYDOR_RELEASE_WEB_ORIGIN="${FYDOR_RELEASE_WEB_ORIGIN:-https://fydor.vercel.app}"
FYDOR_UPDATER_ENDPOINT="${FYDOR_UPDATER_ENDPOINT:-$FYDOR_RELEASE_WEB_ORIGIN/downloads/latest.json}"

export VITE_FYDOR_WEB_ORIGIN="$FYDOR_RELEASE_WEB_ORIGIN"
export FYDOR_WEB_ORIGIN="$FYDOR_RELEASE_WEB_ORIGIN"
export FYDOR_UPDATER_ENDPOINT

check_release_env() {
  case "$FYDOR_RELEASE_WEB_ORIGIN" in
    https://*)
      ;;
    *)
      echo "FAIL FYDOR_RELEASE_WEB_ORIGIN must be an HTTPS origin for packaged releases."
      exit 1
      ;;
  esac

  if printf '%s' "$FYDOR_RELEASE_WEB_ORIGIN" | grep -Eq '[?#]|://[^/]*@|https://[^/]+/.+'; then
    echo "FAIL FYDOR_RELEASE_WEB_ORIGIN must be an origin only, with no path, credentials, query, or fragment."
    exit 1
  fi

  case "$FYDOR_UPDATER_ENDPOINT" in
    https://*)
      ;;
    *)
      echo "FAIL FYDOR_UPDATER_ENDPOINT must be an HTTPS URL for packaged releases."
      exit 1
      ;;
  esac

  if printf '%s' "$FYDOR_UPDATER_ENDPOINT" | grep -Eq '://[^/]*@'; then
    echo "FAIL FYDOR_UPDATER_ENDPOINT cannot contain credentials."
    exit 1
  fi

  if [ -z "${FYDOR_UPDATER_PUBKEY:-}" ]; then
    echo "FAIL FYDOR_UPDATER_PUBKEY is required for release updater verification."
    exit 1
  fi

  if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ] && [ -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ]; then
    echo "FAIL TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH is required to sign updater artifacts."
    exit 1
  fi

  if [ -n "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" ] && [ ! -f "$TAURI_SIGNING_PRIVATE_KEY_PATH" ]; then
    echo "FAIL TAURI_SIGNING_PRIVATE_KEY_PATH does not point to a file."
    exit 1
  fi

  for file in .env .env.local .env.production .env.production.local; do
    [ -f "$file" ] || continue
    if grep -Eq '^(VITE_)?(DATABASE_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PACK_BUCKET)=' "$file"; then
      echo "FAIL $file contains Supabase or database variables. Desktop release env files must only contain public desktop config."
      exit 1
    fi
  done

  env | grep -Eq '^VITE_(DATABASE_URL|SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PACK_BUCKET)=' && {
    echo "FAIL shell contains VITE_* Supabase/database variables that would be exposed to the packaged frontend."
    exit 1
  }

  return 0
}

check_mac_release_env() {
  if [ -z "${FYDOR_MAC_SIGNING_IDENTITY:-}" ]; then
    echo "FAIL FYDOR_MAC_SIGNING_IDENTITY is required. Ad-hoc signing is not allowed for release builds."
    exit 1
  fi
}

check_windows_release_env() {
  if [ -z "${FYDOR_WINDOWS_CERT_PATH:-}" ]; then
    echo "FAIL FYDOR_WINDOWS_CERT_PATH is required to sign the Windows installer."
    exit 1
  fi
  if [ ! -f "$FYDOR_WINDOWS_CERT_PATH" ]; then
    echo "FAIL FYDOR_WINDOWS_CERT_PATH does not point to a file."
    exit 1
  fi
  if [ -z "${FYDOR_WINDOWS_CERT_PASSWORD:-}" ]; then
    echo "FAIL FYDOR_WINDOWS_CERT_PASSWORD is required to sign the Windows installer."
    exit 1
  fi
  if ! command -v osslsigncode >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/osslsigncode ]; then
    echo "FAIL missing required tool: osslsigncode"
    exit 1
  fi
}

write_release_config() {
  node scripts/release/write-tauri-release-config.mjs
}
