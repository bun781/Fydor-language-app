import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageState } from "@/components/system/PageState";
import { errorMessage } from "@/lib/errors";
import { getLessons, getPacks } from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { StudyPackMeta } from "@/lib/imported-content/types";
import { StudyScopePicker } from "@/components/study/StudyScopePicker";
import { defaultStudyScope, resolveStudyScope, studyScopeSchema, type StudyScope } from "@/lib/studyScope";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { useImportedLessonBrowser } from "./useImportedLessonBrowser";
import { ImportedContentStudy } from "./ImportedContentStudy";
import { MultipleChoiceMode } from "./MultipleChoiceMode";
import { FillBlankMode } from "./FillBlankMode";

type StudyMode = "lesson" | "fill-blank" | "multiple-choice";

interface Props {
  mode?: StudyMode;
}

const modeContent: Record<StudyMode, { title: string; description: string }> = {
  lesson: {
    title: "Flashcards",
    description: "Study and review saved lessons sentence by sentence."
  },
  "fill-blank": {
    title: "Fill Blank",
    description: "Practice active recall by filling missing words, grammar patterns, and chunks."
  },
  "multiple-choice": {
    title: "Multiple Choice",
    description: "Quiz yourself on the same imported lesson pool with multiple-choice prompts."
  }
};

export function ImportedContentWorkspace({ mode = "lesson" }: Props) {
  const content = modeContent[mode];
  const [allLessons, setAllLessons] = useState<StudyLessonMeta[]>([]);
  const [packs, setPacks] = useState<StudyPackMeta[]>([]);
  const [scope, setScope] = useState<StudyScope>(() => readSessionProgress("study.scope", studyScopeSchema) ?? defaultStudyScope(true));
  const [quizScope, setQuizScope] = useState<StudyScope>(() => readSessionProgress("study.quiz.scope", studyScopeSchema) ?? defaultStudyScope());
  const [quizScopeInitialized, setQuizScopeInitialized] = useState(() => Boolean(readSessionProgress("study.quiz.scope", studyScopeSchema)));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      const [lessons, packList] = await Promise.all([getLessons(), getPacks()]);

      if (!cancelled) {
        setAllLessons(lessons);
        setPacks(packList);
      }
    }

    loadLessons()
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Unable to load imported lessons."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedScopeLessonIds = scope.allPacks || scope.packIds.length || scope.lessonIds.length
    ? resolveStudyScope(scope, allLessons, packs)
    : allLessons.map((lesson) => lesson.id);
  const browser = useImportedLessonBrowser(null, allLessons, selectedScopeLessonIds);
  const currentScopeIndex = selectedScopeLessonIds.indexOf(browser.selectedLessonId);
  const nextScopeLessonId = currentScopeIndex >= 0 ? selectedScopeLessonIds[currentScopeIndex + 1] : undefined;
  const nextScopeLesson = nextScopeLessonId ? allLessons.find((lesson) => lesson.id === nextScopeLessonId) : undefined;

  useEffect(() => {
    if (mode === "lesson" || quizScopeInitialized || !browser.selectedLessonId) return;
    const nextScope = { ...defaultStudyScope(), lessonIds: [browser.selectedLessonId] };
    setQuizScope(nextScope);
    setQuizScopeInitialized(true);
    writeSessionProgress("study.quiz.scope", nextScope);
  }, [browser.selectedLessonId, mode, quizScopeInitialized]);

  if (loading) {
    return <PageState eyebrow="Loading" title="Loading flashcards" description="Opening your saved lessons." />;
  }

  if (error) {
    return (
      <PageState
        eyebrow="Storage error"
        tone="error"
        title="Flashcards failed to load"
        description={error}
        actions={<a className="button" href="/study/imported-content">Retry</a>}
      />
    );
  }

  if (!allLessons.length) {
    return (
      <PageState
        eyebrow="No data yet"
        title="No flashcards yet"
        description="Save a lesson first. When lessons exist, this page will show them grouped by language and let you study them sentence by sentence."
        actions={<Link className="button" to="/lessons/manage">Open lesson manager</Link>}
      />
    );
  }

  return (
    <div className="stack">
      <div className="topbar" data-tour="study-mode-title">
        <div>
          <h1>{content.title}</h1>
          <p className="muted">{content.description}</p>
        </div>
      </div>

      {mode === "lesson" && packs.length ? (
        <div data-tour="study-scope-picker">
          <StudyScopePicker
            packs={packs}
            lessons={allLessons}
            scope={scope}
            onChange={(nextScope) => {
              setScope(nextScope);
              writeSessionProgress("study.scope", nextScope);
            }}
            title="Study scope"
          />
        </div>
      ) : null}

      {browser.error ? <p className="review-error">{browser.error}</p> : null}

      {mode === "lesson" ? (
        <ImportedContentStudy
          lesson={browser.lesson}
          loadingLesson={browser.loadingLesson}
          nextLessonTitle={nextScopeLesson?.title}
          onNextLesson={nextScopeLessonId ? () => void browser.switchLesson(nextScopeLessonId) : undefined}
        />
      ) : mode === "fill-blank" ? (
        <FillBlankMode lesson={browser.lesson} lessons={allLessons} packs={packs} studyScope={quizScope} onStudyScopeChange={(nextScope) => { setQuizScope(nextScope); setQuizScopeInitialized(true); writeSessionProgress("study.quiz.scope", nextScope); }} />
      ) : (
        <MultipleChoiceMode lesson={browser.lesson} lessons={allLessons} packs={packs} studyScope={quizScope} onStudyScopeChange={(nextScope) => { setQuizScope(nextScope); setQuizScopeInitialized(true); writeSessionProgress("study.quiz.scope", nextScope); }} />
      )}
    </div>
  );
}
