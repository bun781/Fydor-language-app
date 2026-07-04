# AGENTS.md — Fydor (Habitz) Coding Agent Guide

Fydor is a local-first language-learning desktop app: Next.js (static export) frontend inside a Tauri shell, with all persistence in SQLite via Rust commands. There is no web server and no server-side database — `next.config.ts` uses `output: "export"`.

## Repository Overview

```
/
├── app/                    Next.js App Router pages (all "use client", static export)
│   ├── lessons/manage/     Lesson manager (main entry; / redirects here)
│   ├── admin/imports/      Lesson Builder (same component, builder mode)
│   ├── study/*/            4 study modes (imported-content, fill-blank, multiple-choice, sentence-forge)
│   ├── review/             SRS review deck
│   ├── fydor-exchange/     .fydorpack import/export/sharing
│   └── learning-science/   Static reference page
├── components/             React UI by feature
│   ├── review/             ReviewDeck, ReviewControls, ReviewSentenceCard, ReviewStatsBrowser
│   ├── imported-content/   Study mode UI (flashcards, quiz modes, annotated sentences)
│   ├── admin-imports/      Lesson Builder UI (LessonImportsPage is the big one)
│   ├── language/           Import help panel + preview
│   ├── system/             GuidedTour, PageState
│   ├── ui/                 AudioButton, Tooltip
│   └── AppShell.tsx        Nav shell used by every page
├── lib/
│   ├── desktopApi.ts       ⭐ THE data layer — every Tauri invoke() call lives here
│   ├── review/             Queue building, SRS scheduling, recall modes, deck hooks
│   ├── language/           importResources.ts (guide/prompt content) + types.ts
│   ├── imported-content/   Study mode types and pure utilities
│   ├── speech.ts           Web Speech API service + playback hooks (single file)
│   └── fydor-pack.ts       .fydorpack Zod schema and helpers
├── src-tauri/              Rust backend — source of truth for ALL persistence
│   └── src/
│       ├── main.rs         Command registration
│       ├── lessons/mod.rs  Lesson CRUD, import validation/preview/persist, export
│       ├── review.rs       Review queue + SRS update commands
│       ├── db.rs           SQLite schema, setup, migrations
│       ├── models.rs       Rust structs mirroring the TS types in lib/*/types.ts
│       ├── normalize.rs    Text normalization / canonical keys
│       └── settings.rs     User settings persistence
├── tests/unit/             Vitest tests for pure frontend logic
├── docs/                   Feature docs and historical logs
├── samples/                Sample course content (.json, .fydorpack)
└── scripts/                Icon generation, tauri dev launcher, release scripts
```

## Data Flow

UI component → hook (e.g. `lib/review/useReviewDeck.ts`) → `lib/desktopApi.ts` → `invoke("command")` → Rust command in `src-tauri/src/` → SQLite.

- All reads and writes go through `lib/desktopApi.ts`. Never add another data-access path.
- Command name strings in `invoke("...")` must exactly match the `#[tauri::command]` fn names in Rust. Do not rename either side independently.
- TS types for command payloads live in `lib/{review,language,imported-content}/types.ts` and must stay in shape-sync with `src-tauri/src/models.rs`.
- Frontend state is plain React state + hooks. Session progress persists via `components/imported-content/sessionProgress.ts` (localStorage). There is no state library — do not add one.

## Feature Ownership Map

| Feature | Primary files |
|---|---|
| Review queue order + shortcuts | `lib/review/queue.ts`, `lib/review/keyboard.ts` |
| SRS grading/scheduling | `lib/review/scheduler.ts` (client), `src-tauri/src/review.rs` (persisted) |
| Recall mode progression | `lib/review/recallModes.ts` |
| Review deck state | `lib/review/useReviewDeck.ts` |
| Review UI | `components/review/ReviewDeck.tsx` |
| Lesson import (validate/preview/persist) | `src-tauri/src/lessons/mod.rs` |
| Import guide + prompt templates | `lib/language/importResources.ts` |
| Lesson Builder UI | `components/admin-imports/LessonImportsPage.tsx` |
| Study modes | `components/imported-content/` + `lib/imported-content/` |
| Text normalization / canonical keys | `src-tauri/src/normalize.rs` |
| Database schema | `src-tauri/src/db.rs` |
| .fydorpack format | `lib/fydor-pack.ts` |
| Audio/speech | `lib/speech.ts`, `components/ui/AudioButton.tsx` |
| Tauri bridge | `lib/desktopApi.ts` |

## Validation Order

1. `npm run typecheck` — must pass before anything else
2. `npm test` — Vitest suite
3. `npm run lint`
4. `npm run build` — only after typecheck passes
5. `npm run tauri:dev` — manual smoke test of the affected route only

## Handle With Care

- `src-tauri/src/db.rs` — schema changes need a migration path for existing user databases
- `src-tauri/src/normalize.rs` — canonical-key changes break deduplication against existing data
- `lib/review/scheduler.ts`, `lib/review/queue.ts`, `lib/review/recallModes.ts` — SRS behavior
- `lib/fydor-pack.ts` — pack format is a shared contract with files users have already exported
- Redirect stub routes (`/`, `/lessons/import`, `/lessons/import/preview`) — keep; they preserve old URLs

## Rules Against Common Agent Mistakes

- Work on the smallest file set per task; don't restructure or do unrelated refactors.
- No duplicate state systems — review state lives in SQLite via Tauri commands; do not mirror it in React state or localStorage.
- No new abstractions, barrel exports, or shared utilities unless the task requires them.
- Do not add a second DB access layer or bypass `lib/desktopApi.ts`.
- Do not add business logic to `app/*/page.tsx` files — they are thin shells over components.
- There is no legacy web pipeline: the drizzle/PGlite layer was removed in July 2026. Ignore any docs/history that reference `db/schema.ts`, `lib/server/`, or `lib/language/importLesson.ts` — persistence is Rust-only.
