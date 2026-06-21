"use client";

import { useEffect, useMemo, useState } from "react";
import { getLesson } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { ChangeEvent } from "react";

export function useImportedLessonBrowser(initialLesson: StudyLesson | null, allLessons: StudyLessonMeta[]) {
  const languageGroups = useMemo(() => groupLessonsByLanguage(allLessons), [allLessons]);
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLessonId, setSelectedLessonId] = useState(initialLesson?.id ?? allLessons[0]?.id ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    initialLesson?.language ?? allLessons[0]?.language ?? ""
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
    if (!allLessons.length) {
      setLesson(null);
      setSelectedLessonId("");
      setSelectedLanguage("");
      return;
    }

    if (!selectedLessonId || !allLessons.some((item) => item.id === selectedLessonId)) {
      const fallback = allLessons[0];
      setSelectedLessonId(fallback.id);
      setSelectedLanguage(fallback.language);
    }
  }, [allLessons, selectedLessonId]);

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

    getLesson(selectedLessonId)
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
          setError(err instanceof Error ? err.message : "Unable to load selected lesson.");
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
    const selectedMeta = allLessons.find((item) => item.id === lessonId);
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
