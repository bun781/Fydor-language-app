# Contributor pipeline desktop integration

The hosted contributor/moderation system lives in the separately versioned `fydor-website/` repository. The desktop opens that website for contributor, moderation, and administration workspaces; it does not duplicate their login, API client, or workflow.

Desktop responsibilities are deliberately narrow:

- Personal lessons remain in SQLite and are labeled private/personal.
- Generic Save only calls local Tauri lesson commands.
- **Convert to contributor draft** copies a canonical JSON copy to the user's clipboard and opens the configured website contributor workspace with a validated lesson ID; it does not modify, submit, or publish the personal source.
- Prompt templates can be copied and opened only at the allowlisted ChatGPT or Claude websites through the official Tauri opener plugin.
- Fydor Exchange browses the configured public library endpoint.
- Opening a published lesson downloads it into the normal local import draft.
  The existing Rust import pipeline remains the only persistence path and
  validates the lesson before it can be saved.

Configuration:

- Frontend public-library requests: `VITE_FYDOR_WEB_ORIGIN`
- Rust external links: `FYDOR_WEB_ORIGIN`
- Default production origin: `https://fydor.vercel.app`
- HTTP is accepted only for localhost. Credentials, queries, fragments, unsafe protocols, and arbitrary destinations are rejected.

Authentication is website-owned. The website signs in with a same-origin `/api/auth` endpoint and stores the Supabase session and refresh token only in `HttpOnly`, `SameSite=Strict` cookies. Browser JavaScript never receives an access token, and authenticated mutations require same-origin requests. The desktop app never calls Supabase or the contributor APIs directly.

SQLite migration 6 added `purpose`, `published_stable_id`, `published_version`,
`published_checksum`, and `published_installed_at` to `lessons`. Those columns
remain for compatibility with existing local databases; the current published
lesson flow does not write provenance fields.

Environment-specific administrator-bootstrap instructions belong in the ignored `ADMIN_BOOTSTRAP.local.md` file inside the website repository.
