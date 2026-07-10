# AGENTS.md — Fydor (Habitz) Coding Agent Guide

## Default application target

Unless the user explicitly specifies the website, `fydor-website`, or another
nested project, interpret project requests as changes to the Fydor desktop app
in this repository. Inspect and modify the desktop app first; do not infer that
a request belongs to the website merely because website files are open in the
IDE or mentioned in context.

Fydor is a local-first language-learning desktop app: a Vite + React SPA inside a Tauri shell, with all persistence in SQLite via Rust commands. There is no web server and no server-side database — `vite build` emits a static bundle to `dist/` that Tauri serves. Routing is client-side via React Router's `HashRouter` (hash URLs work from a single static `index.html` without server rewrites).

## Repository Overview

```
/
├── index.html              Vite entry document (favicons, SW unregister script)
├── src/                    App entry + route table
│   ├── main.tsx            ReactDOM root; imports globals.css
│   ├── App.tsx             ⭐ Route table (HashRouter). / redirects to /lessons/manage
│   ├── ErrorBoundary.tsx   Top-level render-error screen
│   ├── globals.css         All styling (single global stylesheet)
│   └── pages/              Pages with their own load logic (ReviewPage, LearningSciencePage);
│                           all other routes are thin shells declared inline in App.tsx
├── components/             React UI by feature
│   ├── review/             ReviewDeck, ReviewControls, ReviewSentenceCard, ReviewStatsBrowser
│   ├── reading/            ReadingWorkspace (tab shell), LessonReader, TextAnalyzer
│   ├── imported-content/   Study mode UI (flashcards, quiz modes, annotated sentences);
│   │                       quizSession.ts = shared quiz engine hook, QuizShell.tsx = shared quiz panels
│   ├── admin-imports/      Lesson Builder UI (LessonImportsPage + LessonBuilderEditor)
│   ├── exchange/           Fydor Exchange UI (pack install/share/library)
│   ├── language/           Import help panel + preview
│   ├── system/             GuidedTour, PageState
│   ├── ui/                 AudioButton, Tooltip, ConfirmDialog, PieChart
│   └── AppShell.tsx        Nav shell used by every page
├── lib/
│   ├── desktopApi.ts       ⭐ THE data layer — every Tauri invoke() call lives here
│   ├── storage.ts          Browser local/session storage helpers with Zod validation
│   ├── review/             Queue building, SRS scheduling, recall modes, deck hooks
│   ├── reading/            Tokenizer, coverage analyzer, reader navigation helpers
│   ├── language/           importResources.ts (guide/prompt content) + types.ts
│   ├── imported-content/   Study mode types and pure utilities
│   ├── speech.ts           Web Speech API service + playback hooks (single file)
│   └── fydor-pack.ts       .fydorpack Zod schema and helpers
├── src-tauri/              Rust backend — source of truth for ALL persistence
│   └── src/
│       ├── main.rs         Command registration
│       ├── lessons/        mod.rs (commands+tests), read.rs (queries/export), import.rs (import pipeline)
│       ├── review.rs       Review queue + SRS update commands
│       ├── db.rs           SQLite schema, setup, migrations
│       ├── models.rs       Rust structs mirroring the TS types in lib/*/types.ts
│       └── normalize.rs    Text normalization / canonical keys
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
- Frontend state is plain React state + hooks. Browser-backed UI/session progress persists via `lib/storage.ts` with Zod validation. There is no state library — do not add one.

## Feature Ownership Map

| Feature | Primary files |
|---|---|
| Review queue order + shortcuts | `lib/review/queue.ts`, `lib/review/keyboard.ts` |
| SRS grading/scheduling | `src-tauri/src/review.rs` (source of truth, incl. FSRS); `lib/review/scheduler.ts` is only the optimistic client mirror |
| Recall mode progression | `lib/review/recallModes.ts` |
| Review deck state | `lib/review/useReviewDeck.ts` |
| Review UI | `components/review/ReviewDeck.tsx` |
| Lesson import (validate/preview/persist) | `src-tauri/src/lessons/import.rs` |
| Import guide + prompt templates | `lib/language/importResources.ts` |
| Lesson Builder UI | `components/admin-imports/LessonImportsPage.tsx` |
| Study modes | `components/imported-content/` + `lib/imported-content/` |
| Reading Mode (lesson reader + text analyzer) | `components/reading/`, `lib/reading/` |
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
- The `/` route redirects to `/lessons/manage` (Navigate in `src/App.tsx`) — keep

## Rules Against Common Agent Mistakes

- Work on the smallest file set per task; don't restructure or do unrelated refactors.
- No duplicate state systems — review state lives in SQLite via Tauri commands; do not mirror it in React state or localStorage.
- No new abstractions, barrel exports, or shared utilities unless the task requires them.
- Do not add a second DB access layer or bypass `lib/desktopApi.ts`.
- Do not add business logic to route declarations in `src/App.tsx` or `src/pages/*` shells — routes stay thin over components.
- There is no legacy web pipeline: the drizzle/PGlite layer was removed in July 2026. Ignore any docs/history that reference `db/schema.ts`, `lib/server/`, or `lib/language/importLesson.ts` — persistence is Rust-only.
