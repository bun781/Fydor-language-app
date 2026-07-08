// Pure helpers for the review progress layer: daily new-card caps, streaks, heatmap
// cells, and mastery percentages. All date handling uses local calendar days to match
// the localtime aggregation in src-tauri (get_review_progress).
import type { ReviewDayActivity, ReviewMasteryStats } from "./types";

// Daily cap on cards that can enter the queue for their first-ever grade. Bounds the
// new-item flood: every ungraded word/grammar/chunk is a "new" card, so large lessons
// would otherwise flood "New only" sessions.
export const DEFAULT_NEW_CARDS_PER_DAY = 20;

export function localDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function newCardsIntroducedOn(activity: ReviewDayActivity[], day: string): number {
  return activity.find((entry) => entry.day === day)?.newCards ?? 0;
}

export function remainingNewCards(activity: ReviewDayActivity[], day: string, cap = DEFAULT_NEW_CARDS_PER_DAY): number {
  return Math.max(0, cap - newCardsIntroducedOn(activity, day));
}

export interface ReviewStreaks {
  current: number;
  longest: number;
}

// Consecutive calendar days with at least one review. The current streak counts back
// from today, or from yesterday when today has no reviews yet (so an unfinished day
// does not read as a broken streak).
export function computeReviewStreaks(activity: ReviewDayActivity[], today: string): ReviewStreaks {
  const activeDays = [...new Set(activity.filter((entry) => entry.reviews > 0).map((entry) => entry.day))].sort();
  if (!activeDays.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let index = 1; index < activeDays.length; index += 1) {
    run = isNextDay(activeDays[index - 1], activeDays[index]) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const lastActive = activeDays[activeDays.length - 1];
  const anchored = lastActive === today || isNextDay(lastActive, today);
  return { current: anchored ? run : 0, longest };
}

export interface HeatmapCell {
  day: string;
  reviews: number;
  newCards: number;
  // 0 = no reviews; 1-4 scale for shading.
  intensity: 0 | 1 | 2 | 3 | 4;
}

// One cell per day for the trailing `days` window ending at `today`, oldest first.
export function buildHeatmapCells(activity: ReviewDayActivity[], today: string, days = 84): HeatmapCell[] {
  const byDay = new Map(activity.map((entry) => [entry.day, entry]));
  const end = parseDayKey(today);
  const cells: HeatmapCell[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    const day = localDayKey(date);
    const entry = byDay.get(day);
    const reviews = entry?.reviews ?? 0;
    cells.push({
      day,
      reviews,
      newCards: entry?.newCards ?? 0,
      intensity: heatmapIntensity(reviews)
    });
  }

  return cells;
}

export function masteryPercent(stats: ReviewMasteryStats): number {
  if (stats.total <= 0) return 0;
  return Math.round((stats.mastered / stats.total) * 100);
}

function heatmapIntensity(reviews: number): HeatmapCell["intensity"] {
  if (reviews <= 0) return 0;
  if (reviews < 5) return 1;
  if (reviews < 15) return 2;
  if (reviews < 30) return 3;
  return 4;
}

function isNextDay(day: string, nextDay: string): boolean {
  const date = parseDayKey(day);
  date.setDate(date.getDate() + 1);
  return localDayKey(date) === nextDay;
}

function parseDayKey(day: string): Date {
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  return new Date(year, (month || 1) - 1, dayOfMonth || 1);
}
