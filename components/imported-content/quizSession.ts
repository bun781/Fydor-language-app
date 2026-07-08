import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getLessonCached } from "@/lib/desktopApi";
import { readLocal, writeLocal } from "@/lib/storage";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";

export type TestMode = "continuous" | "full";
export type TestStatus = "setup" | "active" | "complete";

export interface SavedTestResult {
  id: string;
  completedAt: string;
  mode: TestMode;
  lessonTitles: string[];
  questionCount: number;
  correct: number;
  wrong: number;
}

export const scoreSchema = z.object({
  correct: z.number().int(),
  wrong: z.number().int()
});

export const savedTestResultSchema = z.object({
  id: z.string(),
  completedAt: z.string(),
  mode: z.enum(["continuous", "full"]),
  lessonTitles: z.array(z.string()),
  questionCount: z.number(),
  correct: z.number(),
  wrong: z.number()
});

export function useQuizLessonSelection({
  lesson,
  lessons,
  initialSelectedLessonIds,
  canChangeSelection
}: {
  lesson: StudyLesson | null;
  lessons: StudyLessonMeta[];
  initialSelectedLessonIds: string[];
  canChangeSelection: boolean;
}) {
  const availableLessons = useMemo(() => (
    lessons.length ? lessons : lesson ? [lessonToMeta(lesson)] : []
  ), [lesson, lessons]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => (
    new Set(initialSelectedLessonIds.length ? initialSelectedLessonIds : lesson ? [lesson.id] : [])
  ));
  const [loadedLessons, setLoadedLessons] = useState<StudyLesson[]>(() => (lesson ? [lesson] : []));
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!availableLessons.length) {
      setSelectedLessonIds(new Set());
      return;
    }

    setSelectedLessonIds((current) => {
      const validIds = new Set(availableLessons.map((item) => item.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      if (!next.size) next.add(lesson?.id && validIds.has(lesson.id) ? lesson.id : availableLessons[0].id);
      return next;
    });
  }, [availableLessons, lesson?.id]);

  useEffect(() => {
    if (!lesson) return;
    setLoadedLessons((current) => {
      const others = current.filter((item) => item.id !== lesson.id);
      return [lesson, ...others];
    });
  }, [lesson]);

  useEffect(() => {
    const ids = [...selectedLessonIds];
    if (!ids.length) {
      setLoadedLessons([]);
      return;
    }

    let cancelled = false;
    async function loadSelectedLessons() {
      setLoadingLessons(true);
      setLoadError(null);
      try {
        const loaded = await Promise.all(ids.map((id) => lesson?.id === id ? lesson : getLessonCached(id)));
        if (!cancelled) setLoadedLessons(loaded.filter((item): item is StudyLesson => Boolean(item)));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load selected lessons.");
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    }

    void loadSelectedLessons();
    return () => {
      cancelled = true;
    };
  }, [selectedLessonIds, lesson]);

  function toggleLesson(lessonId: string) {
    if (!canChangeSelection) return;
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  return {
    availableLessons,
    selectedLessonIds,
    loadedLessons,
    loadingLessons,
    loadError,
    toggleLesson
  };
}

export function readSavedQuizResults(storageKey: string): SavedTestResult[] {
  return readLocal(storageKey, z.array(savedTestResultSchema)) ?? [];
}

export function saveQuizResult(storageKey: string, result: SavedTestResult): SavedTestResult[] {
  const next = [result, ...readSavedQuizResults(storageKey)].slice(0, 20);
  writeLocal(storageKey, next);
  return next;
}

export function createResultId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSelectedLessonTitles(lessons: StudyLessonMeta[], selectedIds: Set<string>) {
  return lessons.filter((item) => selectedIds.has(item.id)).map((item) => item.title);
}

function lessonToMeta(lesson: StudyLesson): StudyLessonMeta {
  return {
    id: lesson.id,
    language: lesson.language,
    baseLanguage: lesson.baseLanguage,
    title: lesson.title,
    description: lesson.description,
    level: lesson.level,
    tags: lesson.tags,
    sentenceCount: lesson.sentences.length
  };
}
