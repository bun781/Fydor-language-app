// FSRS-4.5 (Free Spaced Repetition Scheduler): the algorithm behind modern Anki scheduling.
// Pure functions, no storage: callers own persistence. Formulas and default parameters follow
// the published FSRS-4.5 reference implementation (open-spaced-repetition/fsrs4anki).
//
// Difficulty here is FSRS-native (1..10). It is NOT the same scale as the 0..1 difficulty
// column on review_items. Do not mix them without migration.
import type { ReviewGrade } from "./types";

/** FSRS grades: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy. */
export type FsrsGrade = 1 | 2 | 3 | 4;

export interface FsrsState {
  /** Memory stability in days: the interval at which retrievability decays to 90%. */
  stability: number;
  /** FSRS difficulty, clamped to [1, 10]. */
  difficulty: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt: string | null;
  dueAt: string;
}

export const FSRS45_DEFAULT_WEIGHTS: readonly number[] = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
  0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755
];

export const DEFAULT_REQUEST_RETENTION = 0.9;

const DECAY = -0.5;
// FACTOR is chosen so retrievability(t = S) === request retention 0.9 exactly.
const FACTOR = 19 / 81;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RELEARN_DELAY_MS = 10 * 60 * 1000;

export function fsrsGradeFromReviewGrade(grade: ReviewGrade): FsrsGrade {
  if (grade === "forgot") return 1;
  if (grade === "hard") return 2;
  if (grade === "remembered") return 3;
  return 4;
}

export function createFsrsState(now: Date = new Date()): FsrsState {
  return {
    stability: 0,
    difficulty: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: null,
    dueAt: now.toISOString()
  };
}

/** Probability of recall after `elapsedDays` given stability. */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Interval in days at which retrievability drops to `requestRetention`. */
export function nextIntervalDays(stability: number, requestRetention = DEFAULT_REQUEST_RETENTION): number {
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return Math.max(1, Math.round(interval));
}

export function reviewFsrs(
  state: FsrsState,
  grade: FsrsGrade,
  now: Date = new Date(),
  requestRetention = DEFAULT_REQUEST_RETENTION,
  weights: readonly number[] = FSRS45_DEFAULT_WEIGHTS
): FsrsState {
  const isFirstReview = state.repetitions === 0 && state.lapses === 0 && !state.lastReviewedAt;

  let stability: number;
  let difficulty: number;

  if (isFirstReview) {
    stability = initialStability(grade, weights);
    difficulty = initialDifficulty(grade, weights);
  } else {
    const elapsedDays = state.lastReviewedAt
      ? Math.max(0, (now.getTime() - new Date(state.lastReviewedAt).getTime()) / MS_PER_DAY)
      : 0;
    const recall = retrievability(state.stability, elapsedDays);
    difficulty = nextDifficulty(state.difficulty, grade, weights);
    stability = grade === 1
      ? forgetStability(state.difficulty, state.stability, recall, weights)
      : recallStability(state.difficulty, state.stability, recall, grade, weights);
  }

  // "Again" answers relearn within the session (matches existing 10-minute app behavior)
  // instead of waiting the full FSRS interval.
  const dueAt = grade === 1
    ? new Date(now.getTime() + RELEARN_DELAY_MS)
    : new Date(now.getTime() + nextIntervalDays(stability, requestRetention) * MS_PER_DAY);

  return {
    stability: round(stability),
    difficulty: round(difficulty),
    repetitions: grade === 1 ? state.repetitions : state.repetitions + 1,
    lapses: grade === 1 ? state.lapses + 1 : state.lapses,
    lastReviewedAt: now.toISOString(),
    dueAt: dueAt.toISOString()
  };
}

function initialStability(grade: FsrsGrade, w: readonly number[]): number {
  return Math.max(0.1, w[grade - 1]);
}

function initialDifficulty(grade: FsrsGrade, w: readonly number[]): number {
  return clampDifficulty(w[4] - Math.exp(w[5] * (grade - 1)) + 1);
}

function nextDifficulty(difficulty: number, grade: FsrsGrade, w: readonly number[]): number {
  const updated = difficulty - w[6] * (grade - 3);
  // Mean reversion toward the "Easy" initial difficulty keeps D from drifting to the rails.
  return clampDifficulty(w[7] * initialDifficulty(4, w) + (1 - w[7]) * updated);
}

function recallStability(
  difficulty: number,
  stability: number,
  recall: number,
  grade: FsrsGrade,
  w: readonly number[]
): number {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  return stability * (
    1 +
    Math.exp(w[8]) *
    (11 - difficulty) *
    Math.pow(stability, -w[9]) *
    (Math.exp(w[10] * (1 - recall)) - 1) *
    hardPenalty *
    easyBonus
  );
}

function forgetStability(
  difficulty: number,
  stability: number,
  recall: number,
  w: readonly number[]
): number {
  const next = w[11] *
    Math.pow(difficulty, -w[12]) *
    (Math.pow(stability + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - recall));
  // Post-lapse stability can never exceed the stability the card had before the lapse.
  return Math.max(0.1, Math.min(next, stability));
}

function clampDifficulty(value: number): number {
  return Math.min(10, Math.max(1, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
