# Desktop Static Migration Log

## Summary

The app now builds the Next.js frontend as static files in `out/` and Tauri production loads those bundled assets directly. The previous production flow that spawned a bundled Next.js standalone server with Node has been removed.

## Replaced API Routes

- `GET /api/lessons` -> `get_lessons`
- `GET /api/lessons/[id]` -> `get_lesson`
- `POST /api/lessons/import/preview` -> `preview_lesson_import`
- `POST /api/lessons/import` -> `import_lesson`
- `GET /api/review` -> `get_review_queue`
- `PATCH /api/review` -> `update_review_item`

The `app/api` route handlers were removed because this desktop build no longer runs a Next.js server.

## Added Tauri Commands

- `get_lessons`
- `get_lesson`
- `preview_lesson_import`
- `import_lesson`
- `get_review_queue`
- `update_review_item`
- `save_user_settings`

Commands are organized under `src-tauri/src/lessons.rs`, `src-tauri/src/review.rs`, and `src-tauri/src/settings.rs`. Shared SQLite setup lives in `src-tauri/src/db.rs`.

## Frontend Changes

- Added `lib/desktopApi.ts` as the single TypeScript adapter around Tauri `invoke(...)`.
- Replaced frontend `fetch("/api/...")` usage in lesson import, lesson switching, and review updates.
- Converted `/review` and `/study/imported-content` into static client pages that load data through `desktopApi`.
- Converted simple redirect pages to static client redirects so `next export` can prerender them.

## Database

- Runtime data moved to SQLite on the Tauri side.
- The database file is created in Tauri's app data directory as `fydor.sqlite3`.
- Legacy PGlite data is copied into the app-data `pglite/` directory when that directory is empty.
- Schema initialization uses a `schema_migrations` table with version `1`.
- Lesson import validation and duplicate/link behavior were translated from the previous TypeScript route flow.

## Config Changes

- `next.config.ts` uses `output: "export"` and unoptimized images for static export.
- `npm run build` now runs `next build`, which exports static files to `out/`.
- `src-tauri/tauri.conf.json` uses `frontendDist: "../out"` and no longer bundles `next-standalone`.
- `src-tauri/src/main.rs` initializes SQLite and registers commands instead of spawning Node or navigating to localhost.

## Development

- Frontend only: `npm run dev`
- Tauri dev app: `npm run tauri:dev`

Dev mode still uses the configured Next dev server at `http://127.0.0.1:3001`, while production loads bundled static files.

## Build

- Static frontend: `npm run build`
- Desktop app: `npm run tauri:build`

## Verification

- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run test` passed: 27 tests.
- `npm run build` passed and exported static routes to `out/`.
- `cargo check` passed.
- `npm run tauri:build` compiled the release binary and built `Fydor.app`; DMG bundling failed in `bundle_dmg.sh`, so the macOS DMG packaging step still needs follow-up.

## Remaining Limitations

- The old TypeScript PGlite/Drizzle modules remain for existing unit-test coverage and historical reference, but the desktop runtime no longer imports them.
- There is no row-level conversion from existing PGlite data into the active SQLite database yet.
- `save_user_settings` stores settings, but no current UI flow calls it.
