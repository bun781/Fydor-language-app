# Fydor

Fydor is a local-first language learning app for turning lesson material into structured study. It centers on a simple loop:

1. create or import a lesson
2. validate the lesson data
3. study the saved sentences in different modes
4. review what you forgot
5. share lessons through Fydor Exchange

The repository name is `Habitz`, but the app itself is branded as Fydor.

## What It Does

- Lesson management at `/lessons/manage`
- Lesson import and validation with structured JSON
- Imported-content study at `/study/imported-content`
- Fill-in-the-blank study at `/study/fill-blank`
- Multiple-choice study at `/study/multiple-choice`
- Sentence review at `/review`
- Learning science reference page at `/learning-science`
- Lesson sharing and pack import/export at `/fydor-exchange`

## Highlights

- Sentence-centered study keeps vocabulary, grammar, and chunk hints attached to real usage.
- Review uses a lightweight memory queue that prioritizes forgotten items sooner.
- Lesson packs are portable `.fydorpack` files for sharing structured content.
- The desktop shell is powered by Tauri; data is stored locally in SQLite via Rust commands.

## Tech Stack

- Vite 7 + React 19 SPA with hash routing
- React 19
- TypeScript
- Zod for pack validation
- Rust + SQLite (Tauri) for local persistence
- Vitest for unit tests
- Tauri for desktop packaging

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open the app in your browser at the local Vite URL (normally `http://127.0.0.1:3001`).

The database is created automatically on first run. By default, Fydor stores local data in the app data directory for your platform.

## Common Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run tauri:dev
npm run tauri:build
```

## Packaging

Packaged desktop builds use only the public website origin:

```bash
VITE_FYDOR_WEB_ORIGIN=https://fydor.vercel.app
```

Supabase keys, service-role keys, and `DATABASE_URL` belong only in the
`fydor-website` server/Vercel environment. Do not add them to the desktop app's
`.env` files or to any `VITE_*` variable. The release scripts source
`scripts/release/env.sh`, force the production web origin by default, and fail
if desktop release env files contain Supabase or database variables.

## Notes On Data

- Lesson data, review state, and imported content are stored locally in SQLite (see `src-tauri/src/db.rs`).
- The app applies any pending schema migrations when it starts.

## Project Layout

- `src/` - Vite entry point, route table, global styles, and page shells
- `components/` - UI and feature components
- `src-tauri/` - Rust desktop backend (SQLite schema, Tauri commands)
- `lib/` - shared logic for import, study, review, speech, and desktop helpers
- `tests/` - unit tests
- `docs/` - implementation notes and product docs

## Further Reading

- [Fydor Tutorial](docs/fydor-tutorial.md)
- [Review System Notes](docs/review-system.md)
- [Lesson Import System](docs/lesson-import-system.md)
