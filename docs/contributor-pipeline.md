# Contributor pipeline desktop integration

The hosted contributor/moderation system lives in the separately versioned `fydor-website/` repository. Its tracked architecture guide is `fydor-website/docs/contributor-pipeline.md`.

Desktop responsibilities are deliberately narrow:

- Personal lessons remain in SQLite and are labeled private/personal.
- Generic Save only calls local Tauri lesson commands.
- **Convert to contributor draft** copies a canonical JSON copy and opens the configured website contributor workspace; it does not modify, submit, or publish the personal source.
- Prompt templates can be copied and opened only at the allowlisted ChatGPT or Claude websites through the official Tauri opener plugin.
- Fydor Exchange browses the configured public library endpoint.
- `install_published_lesson` verifies canonical SHA-256, schema version, JSON limits, dangerous keys, installed version, and then reuses the Rust lesson import transaction.
- Published updates preserve progress for unchanged sentences and return a warning when reviewed sentences were removed.

Configuration:

- Frontend public-library requests: `VITE_FYDOR_WEB_ORIGIN`
- Rust external links: `FYDOR_WEB_ORIGIN`
- Default production origin: `https://fydor.vercel.app`
- HTTP is accepted only for localhost. Credentials, queries, fragments, unsafe protocols, and arbitrary destinations are rejected.

SQLite migration 6 adds `purpose`, `published_stable_id`, `published_version`, `published_checksum`, and `published_installed_at` to `lessons`. Existing lessons default to `personal`.

Environment-specific administrator-bootstrap instructions belong in the ignored `ADMIN_BOOTSTRAP.local.md` file inside the website repository.
