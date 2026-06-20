# Habitz Sentence Forge

A focused language-learning app for importing lesson JSON, generating Sentence Forge drills, and scheduling self-graded review.

## Stack

- Next.js App Router, React, TypeScript
- PostgreSQL with Drizzle schema and SQL migration
- Zod validation for lesson imports
- Vitest for core validation, drill, normalization, and SRS tests

## Core Flow

1. Paste or upload lesson JSON at `/lessons/import`.
2. Validate and preview sentences, focus items, tokens, warnings, and detected duplicates.
3. Approve the import.
4. Save lessons, sentences, tokens, canonical learning items, links, drills, and review states.
5. Study due drills at `/study/sentence-forge` or `/review`.
6. Self-grade with Failed, Hard, Correct, or Easy.
7. Update the next review date.

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
