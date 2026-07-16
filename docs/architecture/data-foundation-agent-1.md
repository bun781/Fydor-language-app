# Data foundation (Agent 1)

## Audit

The desktop app uses one SQLite database opened in `src-tauri/src/db.rs`; foreign
keys are enabled at connection startup. `schema_migrations` stores monotonically
numbered, transactional migrations. Before this work, migration 8 was current.
`lessons`, `sentences`, `learning_items`, annotation link tables, `review_items`,
`item_review_states`, and append-only `review_events` are the relevant persisted
records. Rust in `src-tauri/src/review.rs` is the scheduling authority; TypeScript
only mirrors optimistic UI semantics.

Existing migration risks were preserved: lesson strings are part of export/import
compatibility, existing `review_items` carry due dates and scheduler engine state,
and historical event `grade` values are not rewritten. Validation commands are
`npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, plus `cargo test
--manifest-path src-tauri/Cargo.toml` and `cargo fmt --check`.

## Implemented architecture

Migrations 9–11 add canonical `languages`, ordered directional `language_pairs`,
and `lessons.language_pair_id`. Blank legacy values resolve only to the explicit
`Unknown Language` (`und`) record; no language is guessed. The selected pair is
persisted in `user_settings`.

Courses, units, and collections are relationships only. `unit_lessons` and
`course_lessons` reference canonical lessons rather than owning or duplicating
them. Curriculum commands verify pair consistency before assignment and reorder
within a transaction.

Review events gain nullable normalized response, hint, session, mode, and pair
metadata. Old `forgot`/`remembered` rows remain valid; new inputs accept
Again/Hard/Good/Easy and retain the legacy scheduling grade for compatibility.

Annotation foundation tables provide aliases, provenance/reuse eligibility, and
pair-scoped suppressions with lookup indexes. They do not alter existing learning
item or annotation links.

## Migration invariants

1. Existing lessons, sentences, review rows, events, state, and due dates are never
   deleted or recalculated.
2. All course/unit membership is language-pair scoped.
3. Historical review events are interpreted through legacy grade mapping, not
   transformed in place.
4. Each numbered migration is a single SQLite transaction, including its version
   record.
