import { describe, expect, it } from "vitest";
import {
  getSelectedLessonTitles,
  type SavedTestResult
} from "@/components/imported-content/quizSession";
import { stableShuffle } from "@/lib/imported-content/stableShuffle";
import type { StudyLessonMeta } from "@/lib/imported-content/types";

describe("quiz session helpers", () => {
  it("shuffles deterministically by seed without mutating the input", () => {
    const values = ["a", "b", "c", "d"];
    const first = stableShuffle(values, "seed");
    const second = stableShuffle(values, "seed");

    expect(first).toEqual(second);
    expect(first).not.toEqual(values);
    expect(values).toEqual(["a", "b", "c", "d"]);
  });

  it("uses different orders for different seeds", () => {
    expect(stableShuffle(["a", "b", "c", "d"], "one")).not.toEqual(
      stableShuffle(["a", "b", "c", "d"], "two")
    );
  });

  it("returns lesson titles in available lesson order", () => {
    const lessons: StudyLessonMeta[] = [
      lesson("lesson-1", "Basics"),
      lesson("lesson-2", "Travel"),
      lesson("lesson-3", "Food")
    ];

    expect(getSelectedLessonTitles(lessons, new Set(["lesson-3", "lesson-1"]))).toEqual(["Basics", "Food"]);
  });

  it("keeps the saved result shape shared by quiz modes", () => {
    const result: SavedTestResult = {
      id: "result-1",
      completedAt: "2026-07-01T10:00:00.000Z",
      mode: "continuous",
      lessonTitles: ["Basics"],
      questionCount: 10,
      correct: 8,
      wrong: 2
    };

    expect(result.correct + result.wrong).toBe(result.questionCount);
  });
});

function lesson(id: string, title: string): StudyLessonMeta {
  return {
    id,
    title,
    language: "ko",
    baseLanguage: "en",
    description: null,
    level: null,
    tags: [],
    sentenceCount: 1
  };
}
