# UPDATE_PLAN_FOR_LLM.md — Canonical LLM Session Handoff

Last updated: 2026-07-08 (Vite migration + Reading Mode session).
Read `AGENTS.md` first — it is the authoritative architecture guide. This file
tracks session-to-session status, decisions, and next tasks.

## Current Architecture (post-Vite migration)

- **Frontend**: Vite 7 + React 19 SPA. Entry: `index.html` → `src/main.tsx` →
  `src/App.tsx` (React Router `HashRouter` route table). No Next.js remains.
- **Routing**: hash-based (`/#/lessons/manage`). Chosen so the static Tauri
  bundle (single `index.html` in `dist/`) deep-links without server rewrites.
  `/` and unknown paths redirect to `/lessons/manage`.
- **Error handling**: `src/ErrorBoundary.tsx` wraps the router (replaces Next's
  `error.tsx`/`global-error.tsx`).
- **Backend**: unchanged — Tauri 2 + Rust + SQLite (`src-tauri/`). All data via
  `lib/desktopApi.ts` → `invoke()`. `frontendDist: ../dist`, dev on port 3001
  (`scripts/tauri-dev.mjs` picks a free port and overrides config for dev).
- **State**: plain React state; UI/session persistence via `lib/storage.ts`
  (zod-validated localStorage). Review/scheduling truth lives in SQLite only.
- **Modes** = routes. Switching modes unmounts the previous mode's components;
  each mode persists exactly its own storage key(s) (`review.deck`,
  `review.selected-lessons`, `reading.position`, `app-shell`, quiz results).
  There is no shared mutable mode state to go stale.

## Completed Work (this session, 2026-07-08)

1. **Next.js → Vite migration** (commit `Migrate desktop frontend from Next.js to Vite + React`):
   - Removed `app/`, `next.config.ts`, `next-env.d.ts`, `out/`, Next deps.
   - `app/*/page.tsx` thin shells → routes in `src/App.tsx`; `app/review/page.tsx`
     → `src/pages/ReviewPage.tsx`; learning-science → `src/pages/LearningSciencePage.tsx`.
   - `next/link|navigation|image` → `react-router-dom` / `<img>` in: AppShell,
     GuidedTour, FydorExchangePage, ImportedContentWorkspace, FillBlankMode,
     MultipleChoiceMode, ReviewPage, LearningSciencePage.
   - All `"use client"` directives stripped.
   - ESLint: `eslint-config-next` → `typescript-eslint` + `react-hooks` flat
     config. `react-hooks/set-state-in-effect` (new in plugin v7) is disabled
     globally — it flags the codebase's load-then-set pattern everywhere;
     re-enable per-file if refactoring toward event-driven loads.
   - Vitest 2 → 4 (needed to share Vite 7). All 120 tests pass unchanged.
   - Tauri: `frontendDist ../dist`, window `url: index.html`.

2. **Reading Mode rebuilt** (commit `Rebuild Reading Mode as a lesson reader…`):
   - `components/reading/ReadingWorkspace.tsx` is now a tab shell:
     **Read lessons** (`LessonReader.tsx`, new, primary) and **Analyze text**
     (`TextAnalyzer.tsx`, the former paste-in workbench, unchanged logic).
   - LessonReader: lesson list → full sentence-by-sentence reader in stored
     order, annotation tooltips via `AnnotatedSentence`, per-sentence + global
     translation toggles, speech audio, keyboard nav (↓/j, ↑/k, t, Esc),
     position persisted under `reading.position`.
   - Strictly read-only: uses only `getLessons`/`getLessonCached`; cannot touch
     review scheduling.
   - Pure nav helpers in `lib/reading/readerNavigation.ts` + tests
     (`tests/unit/reading-reader.test.ts`).

3. **Review system audited, no code changes needed**: the 2026-07-08 overhaul
   (see `docs/fydor-next-implementation-plan.md`) already covers determinism
   (seeded queue RNG), double-grade protection (`reviewInFlightRef`), mixed
   sentence+item sessions (`item:<id>` key namespace), FSRS-for-new-cards
   policy, daily new-card cap, append-only `review_events`. 24 Rust tests +
   review vitest suites pass.

## Build / Test Status

- `npm run typecheck` ✅  `npm test` ✅ (17 files / 120 tests)
- `npm run lint` ✅  `npm run build` ✅ (dist/, ~510 kB JS chunk)
- `cargo test` (src-tauri) ✅ 24 tests
- `npm run tauri:dev` launches the app against the Vite dev server.

## Database Migration Status

Schema at migration 5 (`review_events`). No schema changes this session.
Nothing frontend-side touches migrations; migrating Next→Vite has zero effect
on user data (same SQLite file, same commands, same localStorage keys).

## Important Invariants (do not break)

- Hash routing: all internal links use React Router `Link to=` — never `<a href>`
  for internal routes (breaks under the tauri:// origin).
- `lib/desktopApi.ts` is the only `invoke()` call site.
- Queue key scheme: raw ids = sentences, `item:<id>` = items
  (`parseReviewTargetKey` null ⇒ sentence). Sentence-only sessions must remain
  byte-identical to the pre-item queue builder.
- LessonReader must stay read-only over review state.
- `lib/storage.ts` zod-validates every read; corrupt values degrade to null.
- Review interleaving ratios in `lib/review/queue.ts` are product decisions.

## Known Issues / Risks

- Single 510 kB JS chunk (warning only). Optional: manualChunks for
  react/lucide if startup ever feels slow — low priority for a desktop app.
- `react-hooks/set-state-in-effect` disabled globally (see above).
- `docs/fydor-next-implementation-plan.md` is historical; this file +
  AGENTS.md are current.
- Release scripts (`scripts/release/*.sh`) call `npm run tauri:build`; they
  were not re-run this session — verify the DMG/NSIS pipeline on next release
  (frontendDist changed from `out/` to `dist/`).

## Recommended Next Tasks

1. Run `npm run tauri:build` end-to-end and smoke the packaged DMG (frontendDist change).
2. Consider highlighting known/learning items inside LessonReader sentences by
   reusing `get_reading_inputs` (analyzer already derives this knowledge).
3. Optional perf: manualChunks split; memo audit in `ReviewDeck` (826 lines —
   candidate for splitting menu vs. active-session subcomponents).
4. Re-enable `react-hooks/set-state-in-effect` file-by-file when touching a
   component anyway.
