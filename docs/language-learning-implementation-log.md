# Language Learning Implementation Log

## Summary

The app now contains only the core lesson import and Sentence Forge review system. User accounts, login, AI tutor features, dashboards, gamification, analytics, payments, notifications, listening, and unrelated legacy curriculum features have been removed.

---

## Architecture

The implementation is single-tenant and unauthenticated. The code separates validation, normalization, import persistence, drill generation, SRS scheduling, API routes, and UI components.

---

## User Flow

Paste or upload lesson JSON at `/lessons/import`, preview detected sentences and learning items, then approve the import. Approval saves the lesson, sentences, tokens, learning item links, drills, and review states. Study due drills at `/study/sentence-forge` or `/review`, self-grade, and update the SRS schedule.

---

## Files Added

* `lib/language/types.ts` - shared language import and drill types.
* `lib/language/importSchema.ts` - JSON parsing and validation.
* `lib/language/normalize.ts` - sentence normalization and stable lesson hashing.
* `lib/language/generateDrills.ts` - deterministic Sentence Forge drill generation.
* `lib/language/importLesson.ts` - preview construction and approved import transaction.
* `lib/language/srs.ts` - fixed interval SRS scheduling.
* `lib/language/studyQueue.ts` - due Sentence Forge queue query.
* `components/language/InteractiveSentence.tsx` - hover/tap token explanations.
* `components/language/ImportPreview.tsx` - approval preview UI.
* `components/language/SentenceForge.tsx` - seven-step study activity.
* `app/lessons/import/page.tsx` - upload/paste import page.
* `app/lessons/import/preview/page.tsx` - preview route redirect.
* `app/study/sentence-forge/page.tsx` - Sentence Forge page.
* `app/review/page.tsx` - review route redirect.
* `app/api/lessons/import/preview/route.ts` - import preview endpoint.
* `app/api/lessons/import/route.ts` - approved import endpoint.
* `app/api/study/sentence-forge/route.ts` - due drill endpoint.
* `app/api/study/sentence-forge/attempt/route.ts` - self-grade endpoint.
* `db/migrations/0001_initial.sql` - single clean schema for this feature.

---

## Files Modified

* `db/schema.ts` - reduced to only lesson import, Sentence Forge drills, and review tables.
* `components/AppShell.tsx` - reduced navigation to Import, Sentence Forge, and Review.
* `app/page.tsx` - redirects to the import flow.
* `app/globals.css` - supports import preview, token explanations, and Sentence Forge.
* `README.md` - documents only the remaining app.
* `package.json` and `package-lock.json` - removed dependencies for deleted features.

---

## Database Changes

Tables:

* `lessons`
* `sentences`
* `sentence_tokens`
* `learning_items`
* `sentence_item_links`
* `drills`
* `review_states`
* `sentence_review_attempts`

Columns:

* Lesson language, level, title, and source hash fields.
* Sentence normalized text and focus metadata.
* Token explanation and linked learning item fields.
* Learning item canonical keys, display text, meaning, explanations, and common mistakes.
* Drill prompt, answer, type, and payload fields.
* Review state next review date, interval, state, and last grade fields.
* Attempt grade, response, drill type, and timestamp fields.

Indexes:

* Unique lesson source hash.
* Unique sentence normalized text per language.
* Unique learning item canonical key.
* Unique drill type per sentence.
* Due review lookup by next review date.

Migrations:

* `0001_initial.sql`

Reasons:

* Prevent duplicate imports.
* Prevent duplicate sentences.
* Deduplicate learning items by canonical key.
* Keep generated drills and SRS state tied to sentence-level study.
* Avoid users and login for the current platform scope.

---

## API / Server Changes

Endpoints:

* `POST /api/lessons/import/preview`
* `POST /api/lessons/import`
* `GET /api/study/sentence-forge`
* `POST /api/study/sentence-forge/attempt`

Validation:

* Invalid JSON, missing language, title, sentence, and translation are rejected.
* Missing tokens and missing drills are warnings.
* Duplicate imports and duplicate sentences block approval.
* Canonical key conflicts are surfaced and block approval.

Responsibilities:

* Preview performs no writes.
* Import writes all rows in one transaction.
* Study attempt stores the attempt and updates the review state.
* No endpoint requires login or user ownership.

---

## Import Pipeline

JSON upload

↓

Validation

↓

Preview

↓

Approval

↓

Deduplication

↓

Database

↓

Drill generation

↓

Ready for study
