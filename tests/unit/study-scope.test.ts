import { describe, expect, it } from "vitest";
import { resolveStudyScope, type StudyScope } from "@/lib/studyScope";
import type { StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";

const packs: StudyPackMeta[] = [
  { id: "pack-a", stableId: "pack-a", title: "Pack A", description: null, authorName: null, organization: null, authorUrl: null, language: "ko", baseLanguage: "en", level: null, tags: [], version: "1", license: null, sourceType: "import", archived: false, lessonCount: 2, sentenceCount: 20 },
  { id: "pack-b", stableId: "pack-b", title: "Pack B", description: null, authorName: null, organization: null, authorUrl: null, language: "ko", baseLanguage: "en", level: null, tags: [], version: "1", license: null, sourceType: "import", archived: false, lessonCount: 1, sentenceCount: 10 },
  { id: "archived", stableId: "archived", title: "Archived", description: null, authorName: null, organization: null, authorUrl: null, language: "ko", baseLanguage: "en", level: null, tags: [], version: "1", license: null, sourceType: "import", archived: true, lessonCount: 1, sentenceCount: 5 }
];

const lessons: StudyLessonMeta[] = [
  { id: "a1", language: "ko", baseLanguage: "en", title: "A1", description: null, level: null, tags: [], sentenceCount: 10, packId: "pack-a", packTitle: "Pack A", packPosition: 0, packArchived: false },
  { id: "a2", language: "ko", baseLanguage: "en", title: "A2", description: null, level: null, tags: [], sentenceCount: 10, packId: "pack-a", packTitle: "Pack A", packPosition: 1, packArchived: false },
  { id: "b1", language: "ko", baseLanguage: "en", title: "B1", description: null, level: null, tags: [], sentenceCount: 10, packId: "pack-b", packTitle: "Pack B", packPosition: 0, packArchived: false },
  { id: "old", language: "ko", baseLanguage: "en", title: "Old", description: null, level: null, tags: [], sentenceCount: 5, packId: "archived", packTitle: "Archived", packPosition: 0, packArchived: true }
];

describe("study scope resolution", () => {
  it("selects all active packs while excluding archived lessons", () => {
    const scope: StudyScope = { allPacks: true, packIds: [], lessonIds: [], excludedLessonIds: [] };
    expect(resolveStudyScope(scope, lessons, packs)).toEqual(["a1", "a2", "b1"]);
  });

  it("allows a lesson exception inside a selected pack", () => {
    const scope: StudyScope = { allPacks: false, packIds: ["pack-a"], lessonIds: [], excludedLessonIds: ["a2"] };
    expect(resolveStudyScope(scope, lessons, packs)).toEqual(["a1"]);
  });
});
