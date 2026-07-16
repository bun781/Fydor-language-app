#!/usr/bin/env bash
set -u

FYDOR_RELEASE_WEB_ORIGIN="${FYDOR_RELEASE_WEB_ORIGIN:-https://fydor.vercel.app}"
export VITE_FYDOR_WEB_ORIGIN="$FYDOR_RELEASE_WEB_ORIGIN"
export FYDOR_WEB_ORIGIN="$FYDOR_RELEASE_WEB_ORIGIN"

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

write_release_config() {
  node scripts/release/write-tauri-release-config.mjs
}
