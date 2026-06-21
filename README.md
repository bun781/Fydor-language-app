# Habitz

A focused language-learning app for building lesson JSON, studying imported lessons, and running a lightweight sentence review tab.

Fydor is free for the people: open access, no paywall, and no subscriptions.

## Stack

- Next.js App Router, React, TypeScript
- PostgreSQL with Drizzle schema and SQL migration
- Zod validation for lesson files
- Vitest for core validation, drill, normalization, and SRS tests

## Core Flow

1. Open the Lesson Builder at `/admin/imports`.
2. Paste, upload, or generate lesson JSON, then validate the lesson.
3. Preview sentences, focus items, tokens, warnings, and detected duplicates.
4. Save the lesson.
5. Save lessons, sentences, tokens, canonical learning items, and links.
6. Browse the Lesson Library at `/study/imported-content` or open `/review` for sentence review.
7. Mark review sentences as Remembered or Not Remembered.
8. Update the next review date or sentence review state immediately.

## What Makes It Different

- Built as an open-access learning tool.
- Designed to stay simple, local-friendly, and focused on study rather than monetization.
- Surfaces saved lessons and sentence review state in one workflow.

## Local Setup

1. Start a local PostgreSQL database named `habitz`.
2. Install dependencies with `npm install`.
3. Run migrations with `npm run db:migrate`.
4. Start the app with `npm run dev`.

By default the app uses `postgres://postgres:postgres@localhost:5432/habitz`. Set `DATABASE_URL` only if your local database uses a different connection string.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
