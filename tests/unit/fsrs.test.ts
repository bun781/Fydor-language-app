import { describe, expect, it } from "vitest";
import {
  createFsrsState,
  fsrsGradeFromReviewGrade,
  nextIntervalDays,
  retrievability,
  reviewFsrs,
  FSRS45_DEFAULT_WEIGHTS
} from "@/lib/review/fsrs";
import { createFsrsEngine, fixedIntervalEngine, getSchedulerEngine } from "@/lib/review/schedulerEngine";

const NOW = new Date("2026-07-01T10:00:00.000Z");

function daysLater(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("FSRS retrievability", () => {
  it("equals exactly 90% when elapsed time equals stability", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 10);
    expect(retrievability(3, 3)).toBeCloseTo(0.9, 10);
  });

  it("decays monotonically with elapsed time", () => {
    expect(retrievability(10, 0)).toBe(1);
    expect(retrievability(10, 5)).toBeGreaterThan(retrievability(10, 20));
    expect(retrievability(0, 5)).toBe(0);
  });
});

describe("FSRS first review", () => {
  it("uses the published initial stability weights per grade", () => {
    const grades = [1, 2, 3, 4] as const;
    for (const grade of grades) {
      const state = reviewFsrs(createFsrsState(NOW), grade, NOW);
      expect(state.stability).toBeCloseTo(FSRS45_DEFAULT_WEIGHTS[grade - 1], 4);
    }
  });

  it("schedules an interval approximately equal to stability at 90% retention", () => {
    const good = reviewFsrs(createFsrsState(NOW), 3, NOW);
    const dueDays = (new Date(good.dueAt).getTime() - NOW.getTime()) / 86_400_000;
    // At retention 0.9, interval(S) is approximately S (rounded to whole days, min 1).
    expect(dueDays).toBe(Math.max(1, Math.round(good.stability)));
  });

  it("assigns higher initial difficulty to worse grades", () => {
    const again = reviewFsrs(createFsrsState(NOW), 1, NOW);
    const easy = reviewFsrs(createFsrsState(NOW), 4, NOW);
    expect(again.difficulty).toBeGreaterThan(easy.difficulty);
    expect(again.difficulty).toBeLessThanOrEqual(10);
    expect(easy.difficulty).toBeGreaterThanOrEqual(1);
  });
});

describe("FSRS review transitions", () => {
  it("grows stability on successive Good reviews", () => {
    let state = reviewFsrs(createFsrsState(NOW), 3, NOW);
    const first = state.stability;
    state = reviewFsrs(state, 3, daysLater(Math.round(first)));
    const second = state.stability;
    state = reviewFsrs(state, 3, daysLater(Math.round(first + second)));

    expect(second).toBeGreaterThan(first);
    expect(state.stability).toBeGreaterThan(second);
    expect(state.repetitions).toBe(3);
    expect(state.lapses).toBe(0);
  });

  it("orders post-review stability by grade: Again < Hard < Good < Easy", () => {
    const base = reviewFsrs(createFsrsState(NOW), 3, NOW);
    const reviewDay = daysLater(3);
    const again = reviewFsrs(base, 1, reviewDay);
    const hard = reviewFsrs(base, 2, reviewDay);
    const good = reviewFsrs(base, 3, reviewDay);
    const easy = reviewFsrs(base, 4, reviewDay);

    expect(again.stability).toBeLessThan(hard.stability);
    expect(hard.stability).toBeLessThan(good.stability);
    expect(good.stability).toBeLessThan(easy.stability);
  });

  it("counts a lapse, caps post-lapse stability, and relearns in 10 minutes on Again", () => {
    let state = reviewFsrs(createFsrsState(NOW), 3, NOW);
    state = reviewFsrs(state, 3, daysLater(3));
    const beforeLapse = state.stability;

    const lapsed = reviewFsrs(state, 1, daysLater(10));

    expect(lapsed.lapses).toBe(1);
    expect(lapsed.repetitions).toBe(state.repetitions);
    expect(lapsed.stability).toBeLessThanOrEqual(beforeLapse);
    expect(new Date(lapsed.dueAt).getTime() - daysLater(10).getTime()).toBe(10 * 60 * 1000);
  });

  it("increases difficulty on Again and decreases it on Easy, staying in [1, 10]", () => {
    const base = {
      ...reviewFsrs(createFsrsState(NOW), 3, NOW),
      difficulty: 5
    };
    const afterAgain = reviewFsrs(base, 1, daysLater(3));
    const afterEasy = reviewFsrs(base, 4, daysLater(3));

    expect(afterAgain.difficulty).toBeGreaterThan(base.difficulty);
    expect(afterEasy.difficulty).toBeLessThan(base.difficulty);

    let hammered = base;
    for (let i = 0; i < 30; i += 1) {
      hammered = reviewFsrs(hammered, 1, daysLater(3 + i));
    }
    expect(hammered.difficulty).toBeLessThanOrEqual(10);
    expect(hammered.difficulty).toBeGreaterThanOrEqual(1);
  });

  it("gives longer intervals when a lower retention is requested", () => {
    expect(nextIntervalDays(20, 0.8)).toBeGreaterThan(nextIntervalDays(20, 0.9));
    expect(nextIntervalDays(20, 0.9)).toBeGreaterThan(nextIntervalDays(20, 0.97));
  });

  it("maps app review grades onto FSRS grades", () => {
    expect(fsrsGradeFromReviewGrade("forgot")).toBe(1);
    expect(fsrsGradeFromReviewGrade("hard")).toBe(2);
    expect(fsrsGradeFromReviewGrade("remembered")).toBe(3);
    expect(fsrsGradeFromReviewGrade("easy")).toBe(4);
  });
});

describe("scheduler engines", () => {
  it("fixed-interval engine reproduces the current production intervals", () => {
    const state = fixedIntervalEngine.initialState(NOW);
    const remembered = fixedIntervalEngine.review(state, "remembered", NOW);
    const forgot = fixedIntervalEngine.review(state, "forgot", NOW);

    expect(remembered.dueAt).toBe("2026-07-04T10:00:00.000Z");
    expect(forgot.dueAt).toBe("2026-07-01T10:10:00.000Z");
    expect(remembered.repetitions).toBe(1);
    expect(forgot.lapses).toBe(1);
  });

  it("fsrs engine reviews through the SchedulingState wrapper", () => {
    const engine = createFsrsEngine();
    const first = engine.review(engine.initialState(NOW), "remembered", NOW);
    const second = engine.review(first, "remembered", daysLater(4));

    expect(first.engine).toBe("fsrs");
    expect(second.stability).toBeGreaterThan(first.stability);
    expect(new Date(second.dueAt).getTime()).toBeGreaterThan(daysLater(4).getTime());
  });

  it("resolves engines by id", () => {
    expect(getSchedulerEngine("fixed-interval").id).toBe("fixed-interval");
    expect(getSchedulerEngine("fsrs").id).toBe("fsrs");
  });

  it("rejects states from a different scheduler engine", () => {
    const fixed = fixedIntervalEngine.initialState(NOW);
    const fsrs = createFsrsEngine().initialState(NOW);

    expect(() => fixedIntervalEngine.review(fsrs, "remembered", NOW)).toThrow(/scheduler state/i);
    expect(() => createFsrsEngine().review(fixed, "remembered", NOW)).toThrow(/scheduler state/i);
  });
});
