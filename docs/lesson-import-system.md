# Lesson Builder System

This document is a handoff guide for future agents working on the lesson import pipeline.

## Purpose

The lesson builder is the canonical content-ingestion path for:

- vocabulary
- grammar
- chunks and expressions
- sentences
- hover explanations
- future SRS and reviews
- future quizzes

Imported content must feed the real learning system. It is not allowed to live in import-only tables.

## Entry Points

- Lesson Builder UI: `/admin/imports`
- Legacy redirect: `/lessons/import`
- Preview API: `POST /api/lessons/import/preview`
- Save API: `POST /api/lessons/import`
- Lesson Library page: `/study/imported-content`

## JSON Contract

Required fields:

- `language`
- `baseLanguage`
- `sentences`
- `sentences[].text`

Optional fields:

- `title`
- `description`
- `source`
- `level`
- `tags`
- `sentences[].translation`
- `sentences[].words`
- `sentences[].grammar`
- `sentences[].chunks`

Validation rules:

- Reject malformed JSON.
- Reject empty lessons.
- Reject duplicate sentence text inside one lesson.
- `word.surface` is required if a word entry exists.
- `grammar.pattern` is required if a grammar entry exists.
- `chunk.surface` is required if a chunk entry exists.
- If `word.surface`, `grammar.surface`, or `chunk.surface` is provided, it must appear in `sentence.text`.
- Revalidate server-side before preview and import.

## Canonical Keys

The app derives all canonical keys. Import files never provide database IDs.

- Sentence key: `language + normalized sentence text`
- Vocabulary key: `language + normalized lemma if present, else normalized surface`
- Grammar key: `language + normalized pattern`
- Chunk key: `language + normalized surface`

Normalization lives in `src-tauri/src/normalize.rs`.

## Database Model

Reused tables:

- `lessons`
- `sentences`
- `learning_items`

Import-specific additions:

- `lesson_sentences`
- `sentence_vocabulary_links`
- `sentence_grammar_links`
- `sentence_chunk_links`

The SQLite schema lives in `src-tauri/src/db.rs`.

## Import Flow

The import flow (Rust, `src-tauri/src/lessons/mod.rs`) is:

1. Parse and validate the lesson JSON.
2. Validate required fields and surface checks.
3. Build a preview.
4. Compare against existing lessons, sentences, and learning items.
5. Block imports if there is a canonical item type conflict.
6. Write everything in a single transaction.
7. Create or reuse sentences by canonical sentence key.
8. Create or reuse learning items by canonical key.
9. Create exact-surface sentence links.
10. Persist the imported lesson and its sentence/item links.

Important behavior:

- Existing meanings and explanations are never overwritten.
- Missing meaning or explanation fields may be filled in.
- Duplicate links are suppressed.
- Transaction rollback should leave the database unchanged on error.

## How Study Pages Consume Imported Data

### Imported Content Demo

The `get_lesson` Tauri command (`src-tauri/src/lessons/mod.rs`) reads lesson content from:

- `lessons`
- `lesson_sentences`
- `sentences`
- `sentence_vocabulary_links`
- `sentence_grammar_links`
- `sentence_chunk_links`
- `learning_items`

The demo page at `/study/imported-content` renders:

- sentence text
- translation
- level and tags
- hoverable vocabulary
- grammar explanations
- chunk explanations

## UI Behavior

The Lesson Builder at `/admin/imports` supports:

- paste JSON
- upload JSON file
- load sample JSON
- validate
- preview
- save
- save summary
- guide and prompt templates

Preview shows:

- lesson title
- language and base language
- level and tags
- sentence count
- sentence text and translation
- words
- grammar
- chunks
- validation errors

## Tests

Prompt templates and guide content are stored in `lib/language/importResources.ts`.

## Extension Points

If you need to extend the importer, these are the main files:

- validation, normalization, persistence, preview, and readback: `src-tauri/src/lessons/mod.rs` and `src-tauri/src/normalize.rs`
- frontend bridge: `lib/desktopApi.ts`
- admin UI: `app/admin/imports/page.tsx`
- lesson library: `app/study/imported-content/page.tsx`
- guide and prompt content: `lib/language/importResources.ts`

## Known Limitations

- Surface matching is normalized string matching, not a tokenizer-aware parser.
- The demo reader shows the latest imported lesson only.
- The importer blocks canonical type conflicts instead of merging them.
- Overwrite mode is not implemented yet.

## Good Next Steps

- Add tokenizer or span-aware parsing for better hover highlighting.
- Add a full lesson browser instead of only the latest imported lesson demo.
- Add overwrite mode for controlled updates.
- Add vocabulary, grammar, and chunk-specific SRS queues.
- Reuse the same canonical records for quiz generation.
