# Language Learning Implementation Log

## Summary

The app now contains the core lesson import flow, imported lesson study view, and sentence review system. User accounts, login, AI tutor features, dashboards, gamification, analytics, payments, notifications, listening, and unrelated legacy curriculum features have been removed.

---

## Architecture

The implementation is single-tenant and unauthenticated. The code separates validation, normalization, import persistence, sentence study, review scheduling, API routes, and UI components.

---

## User Flow

Paste or upload lesson JSON at `/lessons/import`, preview detected sentences and learning items, then approve the import. Approval saves the lesson, sentences, tokens, and learning item links. Study the latest imported lesson at `/study/imported-content` or review sentence state at `/review`.

---

## Files Added

* `lib/language/types.ts` - shared language import types.
* `lib/language/importSchema.ts` - JSON parsing and validation.
* `lib/language/normalize.ts` - sentence normalization and stable lesson hashing.
* `lib/language/importLesson.ts` - preview construction and approved import transaction.
* `lib/language/srs.ts` - fixed interval SRS scheduling.
* `components/language/ImportPreview.tsx` - approval preview UI.
* `app/lessons/import/page.tsx` - upload/paste import page.
* `app/lessons/import/preview/page.tsx` - preview route redirect.
* `app/study/sentence-forge/page.tsx` - compatibility redirect to the lesson library.
* `app/review/page.tsx` - review route redirect.
* `app/api/lessons/import/preview/route.ts` - import preview endpoint.
* `app/api/lessons/import/route.ts` - approved import endpoint.
* `db/migrations/0001_schema_upgrades.sql` - import schema upgrades.

---

## Files Modified

* `db/schema.ts` - reduced to lesson import and sentence review tables.
* `components/AppShell.tsx` - reduced navigation to Import, Lesson Library, and Review.
* `app/page.tsx` - redirects to the import flow.
* `app/globals.css` - supports import preview, token explanations, and review.
* `README.md` - documents only the remaining app.

---

## Database Changes

Tables:

* `lessons`
* `sentences`
* `sentence_tokens`
* `learning_items`
* `sentence_item_links`

Columns:

* Lesson language, level, title, and source hash fields.
* Sentence normalized text and focus metadata.
* Token explanation and linked learning item fields.
* Learning item canonical keys, display text, meaning, explanations, and common mistakes.
Indexes:

* Unique lesson source hash.
* Unique sentence normalized text per language.
* Unique learning item canonical key.

Migrations:

* `0001_schema_upgrades.sql`

Reasons:

* Prevent duplicate imports.
* Prevent duplicate sentences.
* Deduplicate learning items by canonical key.
* Avoid users and login for the current platform scope.

---

## API / Server Changes

Endpoints:

* `POST /api/lessons/import/preview`
* `POST /api/lessons/import`
* `GET /study/imported-content`
* `GET /review`

Validation:

* Invalid JSON, missing language, title, sentence, and translation are rejected.
* Missing tokens are warnings.
* Duplicate imports and duplicate sentences block approval.
* Canonical key conflicts are surfaced and block approval.

Responsibilities:

* Preview performs no writes.
* Import writes all rows in one transaction.
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

Imported lesson available for study
