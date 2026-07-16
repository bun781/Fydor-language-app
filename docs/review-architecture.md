# Review Architecture

Review data is local SQLite state. The only persistence path is:

`UI → lib/desktopApi.ts → Tauri invoke → src-tauri/src/review.rs → SQLite`

## Ownership

- `src-tauri/src/review.rs` owns persisted scheduling, queue queries, grading,
  reset behavior, progress aggregation, and the FSRS implementation.
- `lib/review/queue.ts` orders the already-loaded targets for a session.
- `lib/review/useReviewDeck.ts` owns in-memory session progression and calls the
  Rust commands to persist grades.
- `lib/review/scheduler.ts` is only the short-lived optimistic mirror for
  fixed-interval rows. The returned Rust row is authoritative.
- `components/review/` renders the deck, start panels, controls, and statistics.

## Scheduling Compatibility

New sentence and item rows use FSRS. Rows created under the earlier
fixed-interval policy retain that engine, so their stored `difficulty` and
`stability` values keep their original meaning. Never reinterpret or migrate
those fields without an explicit, tested data migration.

`review_items` stores sentence scheduling. `item_review_states` stores one
scheduling row per canonical learning item and is created on the first item
grade. Both paths use the same Rust scheduling policy.

## Queue Rules

Sentence keys are raw IDs; item keys are `item:<learning-item-id>`. Item
targets include a selected sentence example and become sentence-shaped entries
only for display. `buildInterleavedReviewQueue` is the canonical frontend queue
builder; it deduplicates targets and preserves deterministic ordering from its
seed/options.

The backend is responsible for due/fresh target selection. Do not recreate that
query policy in the frontend.

## Data Safety

- Grades are append-logged in `review_events` and update state atomically.
- Reset scopes must delete only their intended scheduling rows.
- Pack imports must not overwrite review state.
- Reading is read-only: `get_reading_inputs` exposes lexicon and graded-state
  inputs but must not change lesson or review data.

Run `npm test` and `cargo test --manifest-path src-tauri/Cargo.toml` after any
review or scheduler change. The shared grade-contract fixture covers the
frontend/backend payload boundary.
