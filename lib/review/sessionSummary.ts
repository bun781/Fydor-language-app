import { recallModeOrder } from "./recallModes";
import type { ReviewDecision, ReviewSentence } from "./types";

export type ReviewSourceBucket = "due" | "new" | "mastered";

export interface ReviewSessionEvent {
  sentenceId: string;
  lessonId?: string;
  text: string;
  translation: string;
  decision: ReviewDecision;
  before: ReviewSentence;
  after: ReviewSentence;
  sourceBucket: ReviewSourceBucket;
}

export interface ReviewSessionSummary {
  reviewed: number;
  forgot: number;
  hard: number;
  remembered: number;
  easy: number;
  strongRecall: number;
  retrySoon: number;
  strongRecallRate: number;
  promotedRecallModes: number;
  lessonCount: number;
  dueCount: number;
  newCount: number;
  masteredCount: number;
  retrySentenceIds: string[];
  toughestLessons: Array<{ lessonId: string; misses: number }>;
}

export function classifyReviewSource(sentence: ReviewSentence, now = new Date()): ReviewSourceBucket {
  if ((sentence.repetitions ?? 0) === 0) return "new";
  if (new Date(sentence.dueAt ?? 0).getTime() <= now.getTime()) return "due";
  return "mastered";
}

export function buildReviewSessionSummary(events: ReviewSessionEvent[]): ReviewSessionSummary {
  const lessonIds = new Set<string>();
  const retrySentenceIds: string[] = [];
  const weakestLessonCounts = new Map<string, number>();
  let forgot = 0;
  let hard = 0;
  let remembered = 0;
  let easy = 0;
  let promotedRecallModes = 0;
  let dueCount = 0;
  let newCount = 0;
  let masteredCount = 0;

  for (const event of events) {
    if (event.lessonId) lessonIds.add(event.lessonId);
    if (event.sourceBucket === "due") dueCount += 1;
    if (event.sourceBucket === "new") newCount += 1;
    if (event.sourceBucket === "mastered") masteredCount += 1;

    if (event.decision === "forgot") {
      forgot += 1;
      retrySentenceIds.push(event.sentenceId);
      if (event.lessonId) {
        weakestLessonCounts.set(event.lessonId, (weakestLessonCounts.get(event.lessonId) ?? 0) + 1);
      }
    } else if (event.decision === "hard") {
      hard += 1;
      retrySentenceIds.push(event.sentenceId);
      if (event.lessonId) {
        weakestLessonCounts.set(event.lessonId, (weakestLessonCounts.get(event.lessonId) ?? 0) + 1);
      }
    } else if (event.decision === "remembered") {
      remembered += 1;
    } else if (event.decision === "easy") {
      easy += 1;
    }

    if (getRecallModeRank(event.after.recallMode) > getRecallModeRank(event.before.recallMode)) {
      promotedRecallModes += 1;
    }
  }

  const reviewed = events.length;
  const strongRecall = remembered + easy;
  const retrySoon = forgot + hard;

  return {
    reviewed,
    forgot,
    hard,
    remembered,
    easy,
    strongRecall,
    retrySoon,
    strongRecallRate: reviewed ? Math.round((strongRecall / reviewed) * 100) : 0,
    promotedRecallModes,
    lessonCount: lessonIds.size,
    dueCount,
    newCount,
    masteredCount,
    retrySentenceIds,
    toughestLessons: [...weakestLessonCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([lessonId, misses]) => ({ lessonId, misses }))
  };
}

function getRecallModeRank(mode: ReviewSentence["recallMode"]) {
  const normalizedMode = mode ?? "full_support";
  return Math.max(0, recallModeOrder.indexOf(normalizedMode));
}
