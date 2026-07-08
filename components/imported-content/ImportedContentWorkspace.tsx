import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageState } from "@/components/system/PageState";
import { errorMessage } from "@/lib/errors";
import { getLessons } from "@/lib/desktopApi";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      const lessons = await getLessons();

      if (!cancelled) {
        setAllLessons(lessons);
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

  const browser = useImportedLessonBrowser(null, allLessons);

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

      {mode === "lesson" ? (
        <div className="lesson-selector-bar" data-tour="study-selector-bar">
          {browser.languageGroups.length > 1 ? (
          <select
            className="input selector-compact"
            value={browser.selectedLanguage}
            disabled={browser.loadingLesson}
            onChange={browser.handleLanguageChange}
          >
            {browser.languageGroups.map((group) => (
              <option key={group.language} value={group.language}>
                {group.label}
              </option>
            ))}
          </select>
          ) : null}

          {browser.languageLessons.length > 1 ? (
          <select
            className="input selector-compact"
            value={browser.selectedLessonId}
            disabled={browser.loadingLesson}
            onChange={(event) => void browser.switchLesson(event.target.value)}
          >
            {browser.languageLessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
          ) : null}

          {browser.loadingLesson ? <span className="pill">Loading lesson...</span> : null}
        </div>
      ) : null}

      {browser.error ? <p className="review-error">{browser.error}</p> : null}

      {mode === "lesson" ? (
        <ImportedContentStudy lesson={browser.lesson} loadingLesson={browser.loadingLesson} />
      ) : mode === "fill-blank" ? (
        <FillBlankMode lesson={browser.lesson} lessons={allLessons} />
      ) : (
        <MultipleChoiceMode lesson={browser.lesson} lessons={allLessons} />
      )}
    </div>
  );
}
