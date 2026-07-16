import { z } from "zod";
import type { StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";

export interface StudyScope {
  allPacks: boolean;
  packIds: string[];
  lessonIds: string[];
  excludedLessonIds: string[];
}

export const studyScopeSchema = z.object({
  allPacks: z.boolean(),
  packIds: z.array(z.string()),
  lessonIds: z.array(z.string()),
  excludedLessonIds: z.array(z.string())
});

export function defaultStudyScope(allPacks = false): StudyScope {
  return { allPacks, packIds: [], lessonIds: [], excludedLessonIds: [] };
}

export function resolveStudyScope(scope: StudyScope, lessons: StudyLessonMeta[], packs: StudyPackMeta[] = []): string[] {
  const archivedPackIds = new Set(packs.filter((pack) => pack.archived).map((pack) => pack.id));
  const selectedPackIds = scope.allPacks
    ? new Set(packs.filter((pack) => !pack.archived).map((pack) => pack.id))
    : new Set(scope.packIds);
  const explicitLessons = new Set(scope.lessonIds);
  const excludedLessons = new Set(scope.excludedLessonIds);

  return lessons
    .filter((lesson) => {
      if (lesson.packArchived || (lesson.packId && archivedPackIds.has(lesson.packId))) return false;
      if (excludedLessons.has(lesson.id)) return false;
      if (explicitLessons.has(lesson.id)) return true;
      return Boolean(lesson.packId && selectedPackIds.has(lesson.packId));
    })
    .map((lesson) => lesson.id);
}
