# Review Architecture

Fydor persists review progress per sentence in SQLite through the Rust
`review_items` table. Existing rows and newly created rows default to the fixed
interval model:

- forgot: 10 minutes
- hard: 1 day
- remembered: 3 days
- easy: 7 days

The TypeScript side now also contains pure foundations for the next review model:

- `lib/review/reviewableUnit.ts` generalizes review from whole sentences to
  sentence, word, grammar, and chunk units.
- `lib/review/fsrs.ts` implements a pure FSRS-4.5 scheduler.
- `lib/review/schedulerEngine.ts` wraps the existing fixed scheduler and FSRS
  behind a shared state interface.
- `lib/imported-content/coverage.ts` computes canonical-item coverage and i+1
  sentence candidates.
- `lib/imported-content/exercise-generators.ts` creates cloze, reorder, and
  typed-recall exercises from imported lesson content.
- `lib/reading/tokenizer.ts` is the shared tokenizer-aware foundation for
  reading, exercise generation, and future sentence mining.
- `lib/reading/analyzer.ts` maps pasted text tokens to real imported
  vocabulary, grammar, and chunk annotations.

## Current Persistence Contract

All persistence still flows through:

`UI -> lib/desktopApi.ts -> Tauri invoke -> src-tauri/src/review.rs -> SQLite`

The Rust command `update_review_item` is the persisted source of truth for review
grading. Rows with `scheduler_engine = 'fixed-interval'` intentionally mirror
`lib/review/scheduler.ts`. Rows explicitly marked `scheduler_engine = 'fsrs'`
use the Rust FSRS-4.5 port in `src-tauri/src/review.rs`.

## Why FSRS Is Not Yet The Default

Existing fixed-interval rows use `difficulty` as a 0..1 heuristic and
`stability` as a small fixed-interval heuristic. FSRS rows use difficulty 1..10
and stability in days. The `scheduler_engine` column records which meaning a row
uses.

A safe default switch to FSRS should still:

1. Decide whether existing fixed-interval rows stay fixed forever or get a
   one-time conversion to FSRS stability/difficulty.
2. Add a user-visible or settings-backed policy for which engine new rows use.
3. Keep reset and import-created review rows consistent with the selected engine.
4. Compare the TypeScript and Rust FSRS implementations whenever formulas or
   weights change.

## Queue Guarantees

`lib/review/queue.ts` deduplicates sentence IDs before building either the legacy
or interleaved queue. Duplicate rows should not happen, but queue construction is
the last guard before a learner sees repeated cards in one cycle.

`buildTargetedReviewQueue` in `lib/review/queue.ts` accepts sentence rows plus
`ReviewItemTarget` rows. Sentence entries keep their raw sentence ids so
sentence-only sessions are byte-identical to the plain sentence queue —
including persisted session progress and grade dispatch — while item targets
are namespaced as `item:<learningItemId>` and ride the same due/fresh/mastered
interleaving through their best sentence example. A queue key that does not
parse via `parseReviewTargetKey` is a raw sentence id; `item:` keys grade
through `update_item_review`, everything else through `update_review_item`.
The deck consumes item targets by converting them to sentence-shaped entries
with `itemTargetToQueueEntry` (`ReviewDeck` merges them into one target list;
`useReviewDeck` dispatches by key kind), and the review page scopes items to
the lesson selection by requiring the item's example sentence to be in the
selected set.

## Canonical Item Relationships

Imported lessons already create the graph needed by item-level review:

- `learning_items` holds canonical word, grammar, and chunk identities.
- `sentence_vocabulary_links`, `sentence_grammar_links`, and
  `sentence_chunk_links` connect canonical items to sentence examples.
- `lib/review/reviewableUnit.ts` exposes helpers such as
  `getReviewableUnitsForSentence`, `getCanonicalItemsForSentence`,
  `getExamplesForReviewableUnit`, `getBestSentenceExampleForItem`, and
  `getSentencesForCanonicalItem`.

Those helpers use only loaded `StudySentence` data today.

## Persisted Item-Level Scheduling

Schema migration 4 adds `item_review_states`: one row per canonical learning
item (`UNIQUE(learning_item_id)`, cascade on item delete), holding the same
scheduling fields as `review_items` (due date, repetitions, lapses, difficulty,
stability, `scheduler_engine`) without any sentence-shaped columns. It is a new
table — `review_items` is untouched, so existing fixed-interval sentence rows
are preserved bit-for-bit, and FSRS remains opt-in per row.

Rows are created lazily on first grade. Items without a row are new/unreviewed;
items without any sentence link are not returned as targets, because there is
nothing to review them through.

Rust commands in `src-tauri/src/review.rs`:

- `get_item_review_targets` returns every linked canonical item with its
  scheduling state (or new-item defaults) and its best sentence example — the
  linked sentence with the fewest total annotations, tie-broken by shorter text
  then sentence id, matching `getBestSentenceExampleForItem` in
  `lib/review/reviewableUnit.ts`.
- `update_item_review` grades an item through the same `schedule_review`
  function used for sentences (shared `SchedulerState`), so fixed-interval and
  FSRS semantics are identical across sentence and item rows.
- `reset_review_progress` with an item scope now also deletes the item's
  scheduling row, returning it to new-item defaults.

TypeScript wrappers live in `lib/desktopApi.ts` (`getItemReviewTargets`,
`updateItemReview`) with the `ReviewItemTarget` type in `lib/review/types.ts`.

## Reading Mode Path

`/reading` is a real local workbench, not a placeholder. It loads lesson
annotations through `lib/desktopApi.ts`, derives a reading lexicon from imported
sentences, infers known item keys from remembered sentence review rows, and then
analyzes pasted text locally.

Current limitations are intentional:

- no sentence mining write path yet
- no language-specific morphology dependency yet
- unknown tokens are token surfaces, not canonical items
- item status is inferred from sentence review state until item scheduling rows
  exist

The persisted item-state table now exists (`item_review_states`, see "Persisted
Item-Level Scheduling"). Reading mode does not consume it yet; switching its
known-item inference from remembered sentences to graded item rows is the next
safe improvement, followed by a Rust read command for reading analysis inputs.

## i+1 Analytics Path

There are two complementary coverage layers:

- `lib/imported-content/coverage.ts` measures lesson and sentence coverage from
  known canonical item keys.
- `lib/reading/analyzer.ts` measures pasted-text token coverage against the
  imported lexicon.

Do not show false precision. Until token-to-canonical matching handles
multi-token chunks and language-specific morphology, reading coverage should be
presented as a practical estimate rather than a complete lexical census.

## Exercise Generation

The generator module is pure and intentionally UI-neutral:

- cloze uses existing annotation spans and restores the sentence by
  `before + answer + after`.
- reorder uses `Intl.Segmenter` when available and falls back to Unicode
  code-point tokenization.
- typed recall prompts from translation and expects the target sentence.

UI modes can adopt the shared generator incrementally. Existing fill-blank and
multiple-choice screens still own their current deck shapes.

## Compatibility Rules

- Existing lessons and packs remain valid because canonical keys and lesson JSON
  shape are unchanged.
- Existing sentence review rows remain fixed-interval unless their
  `scheduler_engine` is explicitly changed.
- FSRS numeric fields must never be mixed with fixed-interval numeric fields
  without checking `scheduler_engine`.
- Reading analysis is read-only and must not create or mutate lesson data.

## Migration Rules

Schema changes that affect review must preserve these invariants:

1. Existing sentence review can continue without item rows.
2. New item scheduling rows must reference canonical item identity, not display
   text.
3. Sentence examples remain review vehicles for item targets.
4. Pack import must never overwrite learner review or annotation state silently.
