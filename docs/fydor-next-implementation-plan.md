# Fydor Next Implementation Plan

## What Changed Today (2026-07-08: caps, FSRS default, progress layer, reading inputs)

- Schema migration 5 (`src-tauri/src/db.rs`): append-only `review_events` table —
  one row per grade action (sentence or item) with `was_new` marking a card's
  first-ever grade. Both grade paths in `src-tauri/src/review.rs` log into it;
  progress resets leave it intact.
- FSRS default policy decided and implemented: cards graded for the **first time**
  start on FSRS (`NEW_CARD_SCHEDULER_ENGINE` in `review.rs`, applied in both
  `update_review_item` and `update_item_review`). Rows with existing review
  history keep their engine, so fixed-interval schedules are never reinterpreted
  on the FSRS scale. Resetting a card returns it to "new", so its next grade
  starts it on FSRS.
- Daily new-card cap: `buildInterleavedReviewQueue`/`buildTargetedReviewQueue`
  accept `newLimit` (bounds "mixed" and "new" queues; "all" stays uncapped;
  `undefined` is byte-identical to the uncapped queue). `ReviewDeck` computes the
  remaining budget as `DEFAULT_NEW_CARDS_PER_DAY` (20, `lib/review/progress.ts`)
  minus today's `was_new` events, and threads it through `useReviewDeck` options
  and the queue dashboard ("N waiting; daily cap allows M more today").
- Progress/reward layer on the unified target model: `get_review_progress`
  (Rust) aggregates `review_events` into local-day activity plus item/sentence
  mastery counters (mastered = repetitions ≥ 5, items counted over reviewable
  items only). Pure helpers in `lib/review/progress.ts` (streaks, heatmap cells,
  mastery %, new-card budget) feed `components/review/ReviewProgressPanel.tsx`
  (streak / today / new-today / mastery tiles, 12-week heatmap, mastery bars) on
  the review start menu; the snapshot refreshes whenever the menu is shown. The
  panel is additive — the deck works if the command fails.
- Reading knowledge now comes from persisted item state: new
  `src-tauri/src/reading.rs` command `get_reading_inputs` returns minimal
  analysis inputs (lexicon surfaces per canonical item, graded item states,
  remembered-sentence fallback keys) so `/reading` no longer loads full lesson
  bodies. `deriveReadingKnowledge` in `lib/reading/analyzer.ts` treats items with
  repetitions > 0 as known, graded-but-never-recalled as learning, and uses
  remembered-sentence inference only for keys without item rows (item state wins
  per key). `ReadingWorkspace` falls back to the legacy full-lesson path if the
  command is unavailable. `/reading` remains additive and read-only.
- Tests: Rust — engine policy (new vs. already-graded, sentence and item),
  review-event logging, progress aggregation/mastery, reading-input queries.
  Vitest — `review-progress.test.ts` (budget, streaks, heatmap, mastery),
  `reading-knowledge.test.ts` (item-state-driven knowledge end to end), new-card
  cap cases in `review-target-queue.test.ts` including uncapped byte-identity.

## What Changed Previously (2026-07-08: item targets in the review UI)

- The review deck now runs mixed sentence + item sessions. `app/review/page.tsx`
  loads `getItemReviewTargets()` (gracefully degrading to sentences-only if the
  command fails) and scopes items to the lesson selection via their example
  sentence. `ReviewDeck` converts items to sentence-shaped entries with
  `itemTargetToQueueEntry` and feeds one combined target list to the deck hook
  and queue dashboards.
- Grade dispatch is key-based in `lib/review/useReviewDeck.ts`: `item:<id>` keys
  persist through `updateItemReview`, raw sentence ids through the unchanged
  `updateReviewItem` path.
- Key-scheme decision: `buildTargetedReviewQueue` now keeps raw sentence ids and
  namespaces only items (`item:<learningItemId>`). This makes sentence-only
  sessions byte-identical at every level (queue keys, persisted session
  progress, DB calls) instead of only order-identical; `parseReviewTargetKey`
  returning null means "sentence".
- `ReviewSentenceCard` renders item targets as their best example sentence with
  the item surface highlighted (`.review-item-focus`) and a word/grammar/chunk
  focus pill. `ReviewSentence` gained an optional `itemType` for this.
- Mixed-session tests added in `tests/unit/review-target-queue.test.ts`
  (conversion, dispatch parsing, optimistic grading, queue/entry key
  consistency).

## What Changed Previously (2026-07-08: persisted item-level scheduling)

- Schema migration 4 (`src-tauri/src/db.rs`): new `item_review_states` table,
  one lazily-created row per canonical learning item. `review_items` untouched;
  existing fixed-interval rows preserved; FSRS still opt-in per row.
- `src-tauri/src/review.rs`: `get_item_review_targets` (items + scheduling
  state + best sentence example) and `update_item_review` (grades through the
  same `schedule_review` as sentences via a shared `SchedulerState`). Item-scope
  reset now also clears the item's scheduling row. 9 new Rust tests.
- `lib/desktopApi.ts`: `getItemReviewTargets` / `updateItemReview` wrappers;
  `ReviewItemTarget` type in `lib/review/types.ts`.
- `lib/review/queue.ts`: `buildTargetedReviewQueue` mixes sentence and item
  targets under namespaced keys; sentence-only input reproduces the current
  queue exactly. Tests in `tests/unit/review-target-queue.test.ts`.

## What Changed Previously (2026-07-07/08 session)

- Added reviewable-unit foundation in `lib/review/reviewableUnit.ts` (sentence,
  word, grammar, chunk units with canonical-key identity and example selection).
- Added a pure FSRS-4.5 engine in `lib/review/fsrs.ts` and a scheduler engine
  seam in `lib/review/schedulerEngine.ts` (fixed-interval remains the default).
- Ported FSRS-4.5 to Rust in `src-tauri/src/review.rs`, gated per row by the new
  `review_items.scheduler_engine` column (schema migration 3 in
  `src-tauri/src/db.rs`).
- Added FSRS and reviewable-unit tests in `tests/unit/fsrs.test.ts` and
  `tests/unit/reviewable-unit.test.ts`, plus Rust scheduling tests.
- Added a shared tokenizer-aware reading foundation in `lib/reading/tokenizer.ts`.
- Added reading lexicon and coverage analysis in `lib/reading/analyzer.ts`.
- Reused the new tokenizer from `lib/imported-content/text-spans.ts`.
- Added a real `/reading` workbench that uses existing local Tauri data through
  `lib/desktopApi.ts`.
- Added reading tokenizer and analyzer tests in
  `tests/unit/reading-tokenizer.test.ts`.
- Updated navigation and responsive styles for the reading workbench.
- Expanded `docs/review-architecture.md` with item relationships, reading,
  coverage, FSRS, compatibility, and migration notes.

## What Remains

- Add sentence mining from reading tokens only after the item-state and import
  merge semantics are explicit.
- Make the daily new-card cap user-configurable (a `user_settings` key read at
  startup; the cap is currently the `DEFAULT_NEW_CARDS_PER_DAY` constant).
- Consider surfacing per-lesson mastery in `ReviewStatsBrowser` using the same
  `get_review_progress` counters.

## Exact File-Level Next Steps

1. `lib/review/progress.ts` + `settings.rs`: read a `newCardsPerDay` user
   setting (needs a `get_user_settings` read command; only a save command exists
   today) and pass it through `ReviewDeck`.
2. `components/review/ReviewStatsBrowser.tsx`: optional per-lesson mastery once
   a lesson-scoped variant of `get_review_progress` exists.

## Tests Still Needed

- Component-level (rendered) tests for mixed sessions if a DOM test environment
  is ever added; current mixed-session coverage is at the queue/dispatch layer.
- Reading analyzer tests for multi-token chunks once phrase matching is added.
- Pack compatibility tests ensuring imports do not overwrite learner review
  state.

## Risks

- Existing `review_items` is sentence-shaped with `UNIQUE(sentence_id)`;
  overloading it for canonical items would be brittle.
- FSRS and fixed-interval rows use different numeric meanings for difficulty and
  stability.
- Reading status is currently inferred from remembered sentence rows, which is a
  useful bridge but not a durable item mastery model.
- Language-specific tokenization should use vetted libraries only when the Tauri
  and static-export footprint is acceptable.

## Rollback Plan

- `/reading` is additive and read-only. Remove `app/reading/page.tsx`,
  `components/reading/ReadingWorkspace.tsx`, the nav entry, and reading CSS to
  roll back the UI.
- `lib/reading/*` is pure and only used by reading plus the compatibility
  tokenizer export in `text-spans.ts`; restoring the old tokenizer body there
  fully detaches it.
- Schema migration 3 (`src-tauri/src/db.rs`) added the
  `review_items.scheduler_engine` column with default `'fixed-interval'`. It is
  additive and backward compatible; rolling back the code does not require
  removing the column because older readers ignore it.

## Next Agent Prompt

Switch reading-mode known-item inference to persisted item review state. Start
by reading `AGENTS.md`, `docs/review-architecture.md`,
`docs/fydor-next-implementation-plan.md`, `lib/reading/analyzer.ts`,
`src-tauri/src/review.rs` (`get_item_review_targets`), and `lib/desktopApi.ts`.
Make the reading analyzer treat canonical keys with graded `item_review_states`
rows as known (falling back to remembered-sentence inference when no item rows
exist), and add a Rust read command that returns the minimal analysis inputs so
large libraries do not require loading every full lesson in the frontend. Keep
`/reading` additive and read-only. Add analyzer Vitest tests for
item-state-driven knowledge and Rust tests for the new command. Do not change
the .fydorpack format and do not make FSRS the default engine. Run
`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, and
`cargo test` before finishing.
