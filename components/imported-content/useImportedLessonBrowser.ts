import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/lib/errors";
import { getLessonCached } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { ChangeEvent } from "react";
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
  const languageGroups = useMemo(() => groupLessonsByLanguage(availableLessons), [availableLessons]);
  const queryLessonId = getQueryLessonId();
  const [savedSelection] = useState(() => readSessionProgress(SELECTED_LESSON_KEY, selectedLessonSchema));
  const preferredLessonId = queryLessonId ?? savedSelection?.lessonId ?? null;
  const savedLesson = preferredLessonId
    ? availableLessons.find((item) => item.id === preferredLessonId) ?? null
    : null;
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLesson?.id ?? savedLesson?.id ?? availableLessons[0]?.id ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    initialLesson?.language ?? savedLesson?.language ?? availableLessons[0]?.language ?? ""
  );
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLesson) {
      setLesson(initialLesson);
      setSelectedLessonId(initialLesson.id);
      setSelectedLanguage(initialLesson.language);
    }
  }, [initialLesson]);

  useEffect(() => {
    if (!availableLessons.length) {
      setLesson(null);
      setSelectedLessonId("");
      setSelectedLanguage("");
      return;
    }

    if (!selectedLessonId || !availableLessons.some((item) => item.id === selectedLessonId)) {
      const fallback = preferredLessonId
        ? availableLessons.find((item) => item.id === preferredLessonId) ?? availableLessons[0]
        : availableLessons[0];
      setSelectedLessonId(fallback.id);
      setSelectedLanguage(fallback.language);
      writeSessionProgress(SELECTED_LESSON_KEY, { lessonId: fallback.id });
    }
  }, [availableLessons, preferredLessonId, selectedLessonId]);

  const activeLanguageGroup = languageGroups.find((group) => group.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];

  useEffect(() => {
    if (!selectedLanguage && languageGroups[0]) {
      setSelectedLanguage(languageGroups[0].language);
    }
  }, [languageGroups, selectedLanguage]);

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
          setSelectedLanguage(next.language);
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
    const selectedMeta = availableLessons.find((item) => item.id === lessonId);
    if (selectedMeta) setSelectedLanguage(selectedMeta.language);
  }

  function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
    const language = event.target.value;
    setSelectedLanguage(language);
    const group = languageGroups.find((item) => item.language === language);
    const nextLesson = group?.lessons[0];
    if (nextLesson) void switchLesson(nextLesson.id);
  }

  return {
    handleLanguageChange,
    error,
    languageGroups,
    languageLessons,
    lesson,
    loadingLesson,
    selectedLessonId,
    selectedLanguage,
    switchLesson
  };
}

function getQueryLessonId() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("lessonId");
}
