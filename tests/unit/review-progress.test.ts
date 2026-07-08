import { describe, expect, it } from "vitest";
import {
  buildHeatmapCells,
  computeReviewStreaks,
  DEFAULT_NEW_CARDS_PER_DAY,
  localDayKey,
  masteryPercent,
  newCardsIntroducedOn,
  remainingNewCards
} from "@/lib/review/progress";
import type { ReviewDayActivity } from "@/lib/review/types";

function day(dayKey: string, reviews: number, newCards = 0): ReviewDayActivity {
  return { day: dayKey, reviews, newCards };
}

describe("daily new-card budget", () => {
  it("reads today's introduced new cards from the activity log", () => {
    const activity = [day("2026-07-07", 30, 12), day("2026-07-08", 10, 4)];
    expect(newCardsIntroducedOn(activity, "2026-07-08")).toBe(4);
    expect(newCardsIntroducedOn(activity, "2026-07-09")).toBe(0);
  });

  it("computes the remaining budget against the default cap", () => {
    const activity = [day("2026-07-08", 10, 4)];
    expect(remainingNewCards(activity, "2026-07-08")).toBe(DEFAULT_NEW_CARDS_PER_DAY - 4);
  });

  it("never goes below zero when the cap is exceeded", () => {
    const activity = [day("2026-07-08", 100, DEFAULT_NEW_CARDS_PER_DAY + 5)];
    expect(remainingNewCards(activity, "2026-07-08")).toBe(0);
  });

  it("supports a custom cap", () => {
    const activity = [day("2026-07-08", 10, 4)];
    expect(remainingNewCards(activity, "2026-07-08", 5)).toBe(1);
  });
});

describe("review streaks", () => {
  it("is zero with no review history", () => {
    expect(computeReviewStreaks([], "2026-07-08")).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days ending today", () => {
    const activity = [day("2026-07-06", 5), day("2026-07-07", 3), day("2026-07-08", 1)];
    expect(computeReviewStreaks(activity, "2026-07-08")).toEqual({ current: 3, longest: 3 });
  });

  it("keeps the streak alive when today has no reviews yet", () => {
    const activity = [day("2026-07-06", 5), day("2026-07-07", 3)];
    expect(computeReviewStreaks(activity, "2026-07-08").current).toBe(2);
  });

  it("breaks the current streak after a missed day but remembers the longest", () => {
    const activity = [day("2026-07-01", 5), day("2026-07-02", 3), day("2026-07-03", 2), day("2026-07-06", 1)];
    expect(computeReviewStreaks(activity, "2026-07-08")).toEqual({ current: 0, longest: 3 });
  });

  it("spans month boundaries", () => {
    const activity = [day("2026-06-30", 4), day("2026-07-01", 4)];
    expect(computeReviewStreaks(activity, "2026-07-01")).toEqual({ current: 2, longest: 2 });
  });

  it("ignores zero-review days in the log", () => {
    const activity = [day("2026-07-07", 0), day("2026-07-08", 2)];
    expect(computeReviewStreaks(activity, "2026-07-08")).toEqual({ current: 1, longest: 1 });
  });
});

describe("heatmap cells", () => {
  it("returns one cell per trailing day, oldest first, ending today", () => {
    const cells = buildHeatmapCells([], "2026-07-08", 7);
    expect(cells).toHaveLength(7);
    expect(cells[0].day).toBe("2026-07-02");
    expect(cells[6].day).toBe("2026-07-08");
  });

  it("scales intensity with review volume", () => {
    const activity = [
      day("2026-07-05", 1),
      day("2026-07-06", 10),
      day("2026-07-07", 20),
      day("2026-07-08", 40)
    ];
    const cells = buildHeatmapCells(activity, "2026-07-08", 5);
    expect(cells.map((cell) => cell.intensity)).toEqual([0, 1, 2, 3, 4]);
  });

  it("carries review and new-card counts into the cells", () => {
    const cells = buildHeatmapCells([day("2026-07-08", 7, 2)], "2026-07-08", 1);
    expect(cells[0]).toEqual({ day: "2026-07-08", reviews: 7, newCards: 2, intensity: 2 });
  });
});

describe("mastery percent", () => {
  it("is zero for an empty library", () => {
    expect(masteryPercent({ total: 0, graded: 0, mastered: 0 })).toBe(0);
  });

  it("rounds the mastered share of the whole library", () => {
    expect(masteryPercent({ total: 3, graded: 3, mastered: 1 })).toBe(33);
    expect(masteryPercent({ total: 4, graded: 2, mastered: 4 })).toBe(100);
  });
});

describe("local day keys", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(localDayKey(new Date(2026, 6, 8, 23, 59))).toBe("2026-07-08");
    expect(localDayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});
