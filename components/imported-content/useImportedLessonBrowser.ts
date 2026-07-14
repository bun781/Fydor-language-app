import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { getLessonCached } from "@/lib/desktopApi";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";

const SELECTED_LESSON_KEY = "selected-lesson";

const selectedLessonSchema = z.object({ lessonId: z.string() });

export function useImportedLessonBrowser(initialLesson: StudyLesson | null, allLessons: StudyLessonMeta[], allowedLessonIds?: string[]) {
  const availableLessons = useMemo(() => {
    if (!allowedLessonIds?.length) return allLessons;
    const allowed = new Set(allowedLessonIds);
    return allLessons.filter((item) => allowed.has(item.id));
  }, [allLessons, allowedLessonIds]);
  const queryLessonId = getQueryLessonId();
  const [savedSelection] = useState(() => readSessionProgress(SELECTED_LESSON_KEY, selectedLessonSchema));
  const preferredLessonId = queryLessonId ?? savedSelection?.lessonId ?? null;
  const savedLesson = preferredLessonId
    ? availableLessons.find((item) => item.id === preferredLessonId) ?? null
    : null;
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLesson?.id ?? savedLesson?.id ?? availableLessons[0]?.id ?? "");
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLesson) {
      setLesson(initialLesson);
      setSelectedLessonId(initialLesson.id);
    }
  }, [initialLesson]);

  useEffect(() => {
    if (!availableLessons.length) {
      setLesson(null);
      setSelectedLessonId("");
      return;
    }

    if (!selectedLessonId || !availableLessons.some((item) => item.id === selectedLessonId)) {
      const fallback = preferredLessonId
        ? availableLessons.find((item) => item.id === preferredLessonId) ?? availableLessons[0]
        : availableLessons[0];
      setSelectedLessonId(fallback.id);
      writeSessionProgress(SELECTED_LESSON_KEY, { lessonId: fallback.id });
    }
  }, [availableLessons, preferredLessonId, selectedLessonId]);

  useEffect(() => {
    if (!selectedLessonId || lesson?.id === selectedLessonId) return;

    let cancelled = false;
    setLoadingLesson(true);
    setError(null);

    getLessonCached(selectedLessonId)
      .then((next) => {
        if (cancelled) return;
        if (next) {
          setLesson(next);
        } else {
          setLesson(null);
          setError("Selected lesson could not be loaded.");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLesson(null);
          setError(errorMessage(err, "Unable to load selected lesson."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLesson(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lesson?.id, selectedLessonId]);

  function switchLesson(lessonId: string) {
    setSelectedLessonId(lessonId);
    writeSessionProgress(SELECTED_LESSON_KEY, { lessonId });
  }

  return {
    error,
    lesson,
    loadingLesson,
    selectedLessonId,
    switchLesson
  };
}

function getQueryLessonId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("lessonId");
}
