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
- The app runs locally with PGlite-backed storage and Drizzle migrations.
- The desktop shell is powered by Tauri.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Drizzle ORM
- PGlite for local persistence
- Zod for lesson validation
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

3. Open the app in your browser at the local dev URL printed by Next.js.

The database is created automatically on first run. By default, Fydor stores local data in the app data directory for your platform.

## Common Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:migrate
npm run tauri:dev
npm run tauri:build
```

## Notes On Data

- Lesson data, review state, and imported content are stored locally.
- Migrations live in `db/migrations`.
- The app will automatically apply pending migrations when it starts.

## Project Layout

- `app/` - routes and page entry points
- `components/` - UI and feature components
- `db/` - schema and migrations
- `lib/` - shared logic for import, study, review, speech, and desktop helpers
- `tests/` - unit tests
- `docs/` - implementation notes and product docs

## Further Reading

- [Fydor Tutorial](docs/fydor-tutorial.md)
- [Review System Notes](docs/review-system.md)
- [Lesson Import System](docs/lesson-import-system.md)
- [Codex Context Map](docs/codex-context-map.md)
