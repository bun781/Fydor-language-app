// Engine seam between "what was reviewed" and "when to show it again". Units of any type
// (sentence, word, grammar, chunk; see reviewableUnit.ts) carry a SchedulingState; the
// engine only ever sees that state plus a grade, so item-level scheduling reuses this as-is.
//
// Two engines exist:
//   - "fixed-interval": the current production behavior (10min/1d/3d/7d), byte-compatible
//     with applyReviewDecision and src-tauri/src/review.rs.
//   - "fsrs": real FSRS-4.5 (see fsrs.ts). Rust can persist FSRS rows when
//     review_items.scheduler_engine is "fsrs", but fixed-interval remains the default.
import {
  createFsrsState,
  fsrsGradeFromReviewGrade,
  reviewFsrs,
  DEFAULT_REQUEST_RETENTION,
  type FsrsState
} from "./fsrs";
import { scheduleNextDueAt, updateDifficulty, updateStability } from "./scheduler";
import type { ReviewGrade, SchedulerEngineId } from "./types";

export interface SchedulingState {
  /** Which engine's semantics the numeric fields use. */
  engine: SchedulerEngineId;
  dueAt: string;
  lastReviewedAt: string | null;
  repetitions: number;
  lapses: number;
  /** fixed-interval: 0..1 heuristic. fsrs: FSRS difficulty 1..10. */
  difficulty: number;
  /** fixed-interval: streak-like heuristic. fsrs: memory stability in days. */
  stability: number;
}

export interface SchedulerEngine {
  readonly id: SchedulerEngineId;
  initialState(now?: Date): SchedulingState;
  review(state: SchedulingState, grade: ReviewGrade, now?: Date): SchedulingState;
}

export const fixedIntervalEngine: SchedulerEngine = {
  id: "fixed-interval",

  initialState(now: Date = new Date()): SchedulingState {
    return {
      engine: "fixed-interval",
      dueAt: now.toISOString(),
      lastReviewedAt: null,
      repetitions: 0,
      lapses: 0,
      difficulty: 0.3,
      stability: 0
    };
  },

  review(state: SchedulingState, grade: ReviewGrade, now: Date = new Date()): SchedulingState {
    assertEngineState(state, "fixed-interval");
    return {
      engine: "fixed-interval",
      dueAt: scheduleNextDueAt(grade, now).toISOString(),
      lastReviewedAt: now.toISOString(),
      repetitions: grade === "remembered" || grade === "easy" ? state.repetitions + 1 : state.repetitions,
      lapses: grade === "forgot" ? state.lapses + 1 : state.lapses,
      difficulty: updateDifficulty(state.difficulty, grade),
      stability: updateStability(state.stability, grade)
    };
  }
};

export function createFsrsEngine(requestRetention = DEFAULT_REQUEST_RETENTION): SchedulerEngine {
  return {
    id: "fsrs",

    initialState(now: Date = new Date()): SchedulingState {
      return toSchedulingState(createFsrsState(now));
    },

    review(state: SchedulingState, grade: ReviewGrade, now: Date = new Date()): SchedulingState {
      assertEngineState(state, "fsrs");
      const next = reviewFsrs(toFsrsState(state), fsrsGradeFromReviewGrade(grade), now, requestRetention);
      return toSchedulingState(next);
    }
  };
}

export const fsrsEngine: SchedulerEngine = createFsrsEngine();

export function getSchedulerEngine(id: SchedulerEngineId): SchedulerEngine {
  return id === "fsrs" ? fsrsEngine : fixedIntervalEngine;
}

function toSchedulingState(state: FsrsState): SchedulingState {
  return {
    engine: "fsrs",
    dueAt: state.dueAt,
    lastReviewedAt: state.lastReviewedAt,
    repetitions: state.repetitions,
    lapses: state.lapses,
    difficulty: state.difficulty,
    stability: state.stability
  };
}

function toFsrsState(state: SchedulingState): FsrsState {
  return {
    stability: state.stability,
    difficulty: state.difficulty,
    repetitions: state.repetitions,
    lapses: state.lapses,
    lastReviewedAt: state.lastReviewedAt,
    dueAt: state.dueAt
  };
}

function assertEngineState(state: SchedulingState, engine: SchedulerEngineId): void {
  if (state.engine !== engine) {
    throw new Error(`Cannot review ${state.engine} scheduler state with ${engine} engine`);
  }
}
