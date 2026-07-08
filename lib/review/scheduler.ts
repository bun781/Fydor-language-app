// Optimistic presentation-state update for a just-graded card. Scheduling (due dates,
// intervals, repetitions, difficulty, stability, engine selection) is computed ONLY in
// src-tauri/src/review.rs: the saved row replaces this optimistic one as soon as the
// Tauri call resolves, and useReviewDeck rolls the card back if the save fails. Keeping
// interval math out of the client means Rust and TypeScript cannot drift.
//
// What IS duplicated across the boundary (grade normalization, legacy review-state
// mapping, recall-mode progression) is pinned by tests/fixtures/review-grade-contract.json,
// asserted from both vitest (review-contract.test.ts) and cargo test (review.rs).
import { progressRecallMode } from "./recallModes";
import type { ReviewGrade, ReviewSentence, SentenceReviewState } from "./types";

function normalizeReviewGrade(decision: ReviewGrade | "forgotten"): ReviewGrade {
  return decision === "forgotten" ? "forgot" : decision;
}

export function applyReviewDecision(
  sentence: ReviewSentence,
  decision: ReviewGrade | "forgotten",
  reviewedAt = new Date()
): ReviewSentence {
  const grade = normalizeReviewGrade(decision);
  return {
    ...sentence,
    reviewState: toLegacyReviewState(grade),
    reviewStreak: grade === "remembered" || grade === "easy" ? sentence.reviewStreak + 1 : grade === "forgot" ? 0 : sentence.reviewStreak,
    reviewedAt: reviewedAt.toISOString(),
    lastReviewedAt: reviewedAt.toISOString(),
    recallMode: progressRecallMode(sentence.recallMode ?? "full_support", grade)
  };
}

function toLegacyReviewState(grade: ReviewGrade): SentenceReviewState {
  if (grade === "forgot") return "forgotten";
  if (grade === "hard") return "unknown";
  return "remembered";
}
