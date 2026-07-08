import { ArrowLeft, BookOpen, Eye, EyeOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnnotatedSentence } from "@/components/imported-content/AnnotatedSentence";
import { PageState } from "@/components/system/PageState";
import { AudioButton } from "@/components/ui/AudioButton";
import { getLessonCached, getLessons } from "@/lib/desktopApi";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import {
  nextSentenceIndex,
  previousSentenceIndex,
  toggleRevealedSentence
} from "@/lib/reading/readerNavigation";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";

const READING_POSITION_KEY = "reading.position";

const readingPositionSchema = z.object({
  lessonId: z.string(),
  sentenceIndex: z.number().int().nonnegative(),
  showTranslations: z.boolean()
});
type ReadingPosition = z.infer<typeof readingPositionSchema>;

// Read-only lesson reader: renders every sentence of a lesson in stored order
// with annotations and translations. Uses only lesson read commands — it never
// touches review scheduling or grading.
export function LessonReader() {
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [lesson, setLesson] = useState<StudyLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [showTranslations, setShowTranslations] = useState(false);
  const [revealedSentences, setRevealedSentences] = useState<Set<string>>(new Set());
  const activeSentenceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLessons()
      .then(async (metas) => {
        if (cancelled) return;
        setLessons(metas);
        const saved = readSessionProgress(READING_POSITION_KEY, readingPositionSchema);
        if (saved && metas.some((meta) => meta.id === saved.lessonId)) {
          const restored = await getLessonCached(saved.lessonId);
          if (cancelled || !restored) return;
          setLesson(restored);
          setSentenceIndex(Math.min(saved.sentenceIndex, Math.max(0, restored.sentences.length - 1)));
          setShowTranslations(saved.showTranslations);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load lessons.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist position so reopening Reading Mode returns to the same sentence.
  useEffect(() => {
    if (!lesson) return;
    writeSessionProgress(READING_POSITION_KEY, {
      lessonId: lesson.id,
      sentenceIndex,
      showTranslations
    } satisfies ReadingPosition);
  }, [lesson, sentenceIndex, showTranslations]);

  const openLesson = useCallback(async (lessonId: string) => {
    setError(null);
    try {
      const loaded = await getLessonCached(lessonId);
      if (!loaded) {
        setError("This lesson could not be loaded from the local database.");
        return;
      }
      setLesson(loaded);
      setSentenceIndex(0);
      setRevealedSentences(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the lesson.");
    }
  }, []);

  const closeLesson = useCallback(() => {
    setLesson(null);
    setRevealedSentences(new Set());
  }, []);

  const toggleActiveTranslation = useCallback(() => {
    const active = lesson?.sentences[sentenceIndex];
    if (!active) return;
    setRevealedSentences((current) => toggleRevealedSentence(current, active.id));
  }, [lesson, sentenceIndex]);

  // Keyboard: ↑/k previous, ↓/j next, t toggle active translation, Esc back to list.
  useEffect(() => {
    if (!lesson) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setSentenceIndex((i) => nextSentenceIndex(i, lesson?.sentences.length ?? 0));
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setSentenceIndex((i) => previousSentenceIndex(i, lesson?.sentences.length ?? 0));
      } else if (event.key === "t") {
        event.preventDefault();
        toggleActiveTranslation();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeLesson();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lesson, closeLesson, toggleActiveTranslation]);

  useEffect(() => {
    activeSentenceRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sentenceIndex]);

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => a.title.localeCompare(b.title)),
    [lessons]
  );

  if (loading) {
    return (
      <PageState
        eyebrow="Reading"
        title="Loading lessons"
        description="Collecting your imported lessons from the local database."
      />
    );
  }

  if (error && !lesson) {
    return (
      <PageState
        eyebrow="Reading"
        tone="error"
        title="Reading data could not load"
        description="Reading Mode only uses local app data, so this usually means the Tauri bridge is unavailable."
        details={error}
      />
    );
  }

  if (!lesson) {
    if (!sortedLessons.length) {
      return (
        <PageState
          eyebrow="Reading"
          title="No lessons to read yet"
          description="Import a lesson first. Every imported lesson can be read here sentence by sentence."
        />
      );
    }

    return (
      <div className="reading-lesson-list" role="list" aria-label="Lessons available for reading">
        {sortedLessons.map((meta) => (
          <button
            key={meta.id}
            type="button"
            role="listitem"
            className="reading-lesson-item"
            onClick={() => void openLesson(meta.id)}
          >
            <BookOpen size={17} aria-hidden="true" />
            <span className="reading-lesson-item-body">
              <strong>{meta.title}</strong>
              <span className="muted">
                {meta.language} · {meta.sentenceCount} sentences{meta.level ? ` · ${meta.level}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="reading-reader">
      <div className="reading-reader-toolbar">
        <button className="button secondary" type="button" onClick={closeLesson}>
          <ArrowLeft size={15} /> All lessons
        </button>
        <div className="reading-reader-title">
          <strong>{lesson.title}</strong>
          <span className="muted">
            {sentenceIndex + 1} / {lesson.sentences.length}
          </span>
        </div>
        <button
          className="button secondary"
          type="button"
          aria-pressed={showTranslations}
          onClick={() => setShowTranslations((value) => !value)}
        >
          {showTranslations ? <EyeOff size={15} /> : <Eye size={15} />}
          {showTranslations ? "Hide translations" : "Show translations"}
        </button>
      </div>

      {error ? <p className="muted" role="alert">{error}</p> : null}

      <ol className="reading-sentence-list" aria-label="Lesson sentences">
        {lesson.sentences.map((sentence, index) => {
          const isActive = index === sentenceIndex;
          const translationVisible = showTranslations || revealedSentences.has(sentence.id);
          return (
            <li
              key={sentence.id}
              ref={isActive ? (node) => { activeSentenceRef.current = node; } : undefined}
              className={`reading-sentence${isActive ? " reading-sentence-active" : ""}`}
              onClick={() => setSentenceIndex(index)}
            >
              <div className="reading-sentence-main">
                <AnnotatedSentence sentence={sentence} />
                <AudioButton sentence={sentence.text} language={lesson.language} compact />
              </div>
              {translationVisible && sentence.translation ? (
                <p className="reading-translation muted">{sentence.translation}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      <p className="reading-shortcuts muted">
        <kbd>↑</kbd>/<kbd>↓</kbd> move · <kbd>t</kbd> translation · <kbd>Esc</kbd> lesson list
      </p>
    </div>
  );
}
