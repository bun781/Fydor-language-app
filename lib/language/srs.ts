import type { SentenceGrade } from "@/lib/language/types";

const intervalByGrade: Record<SentenceGrade, number> = {
  failed: 1,
  hard: 3,
  correct: 7,
  easy: 14
};

export function scheduleSentenceReview(grade: SentenceGrade, reviewedAt = new Date()) {
  const intervalDays = intervalByGrade[grade];
  const nextReviewAt = new Date(reviewedAt);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + intervalDays);

  return {
    reviewState: grade === "failed" ? "learning" : "reviewing",
    intervalDays,
    nextReviewAt
  };
}
