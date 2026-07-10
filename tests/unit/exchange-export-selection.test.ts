import { describe, expect, it } from "vitest";
import { filterSelectedLessonIds } from "@/components/exchange/FydorExchangePage";
import type { StudyLessonMeta } from "@/lib/imported-content/types";

describe("exchange export selection", () => {
  it("removes lesson ids that are no longer in the local lesson list", () => {
    const selectedIds = new Set(["lesson-1", "deleted-lesson", "lesson-3"]);
    const lessons = [lesson("lesson-1"), lesson("lesson-3")];

    expect([...filterSelectedLessonIds(selectedIds, lessons)]).toEqual(["lesson-1", "lesson-3"]);
  });

  it("returns an empty selection when every saved id is stale", () => {
    const selectedIds = new Set(["deleted-lesson"]);

    expect(filterSelectedLessonIds(selectedIds, [lesson("lesson-1")]).size).toBe(0);
  });
});

function lesson(id: string): StudyLessonMeta {
  return {
    id,
    title: id,
    language: "ko",
    baseLanguage: "en",
    description: null,
    level: null,
    tags: [],
    sentenceCount: 1
  };
}
