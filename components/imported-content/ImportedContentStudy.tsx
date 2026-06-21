"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ItemFamiliarity,
  RevealState,
  StudyLesson,
  StudyLessonMeta,
  StudySentence
} from "@/lib/imported-content/types";
import { getLesson } from "@/lib/desktopApi";
import { groupLessonsByLanguage } from "@/lib/language/importResources";
import { CheckpointQuiz } from "./CheckpointQuiz";
import { SentenceFlashcard } from "./SentenceFlashcard";

interface Props {
  lesson: StudyLesson | null;
  allLessons: StudyLessonMeta[];
}

const DEFAULT_REVEAL: RevealState = {
  translation: false,
  wordMeanings: false,
  grammar: false,
  hint: false
};

type CardGrade = "easy" | "correct" | "hard" | "failed";

export function ImportedContentStudy({ lesson: initialLesson, allLessons }: Props) {
  const [lesson, setLesson] = useState(initialLesson);
  const [selectedLanguage, setSelectedLanguage] = useState(initialLesson?.language ?? allLessons[0]?.language ?? "");
  const [cardIndex, setCardIndex] = useState(0);
  const [cardOrder, setCardOrder] = useState<string[]>(
    () => initialLesson?.sentences.map((sentence) => sentence.id) ?? []
  );
  const [quizPendingAt, setQuizPendingAt] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState>(DEFAULT_REVEAL);
  const [sessionFamiliarity, setSessionFamiliarity] = useState<Map<string, ItemFamiliarity>>(new Map());
  const [cardGrades, setCardGrades] = useState<Map<string, CardGrade>>(new Map());
  const [loadingLesson, setLoadingLesson] = useState(false);
  const languageGroups = groupLessonsByLanguage(allLessons);

  const sentenceById = useMemo(
    () => new Map(lesson?.sentences.map((sentence) => [sentence.id, sentence]) ?? []),
    [lesson]
  );
  const total = cardOrder.length;
  const sentenceId = cardOrder[cardIndex] ?? null;
  const sentence = sentenceId ? sentenceById.get(sentenceId) ?? null : null;
  const completed = total > 0 && cardIndex >= total;
  const activeLanguageGroup = languageGroups.find((group) => group.language === selectedLanguage) ?? languageGroups[0] ?? null;
  const languageLessons = activeLanguageGroup?.lessons ?? [];
  const summary = useMemo(() => {
    let easy = 0;
    let correct = 0;
    let hard = 0;
    let failed = 0;

    for (const grade of cardGrades.values()) {
      if (grade === "easy") easy += 1;
      else if (grade === "correct") correct += 1;
      else if (grade === "hard") hard += 1;
      else failed += 1;
    }

    return {
      total,
      reviewed: cardGrades.size,
      remaining: Math.max(0, total - cardGrades.size),
      easy,
      correct,
      hard,
      failed
    };
  }, [cardGrades, total]);

  const handlePrev = useCallback(() => {
    setCardIndex((i) => Math.max(0, i - 1));
    setReveal(DEFAULT_REVEAL);
  }, []);

  const handleNext = useCallback(() => {
    const next = cardIndex + 1;
    // Checkpoint quiz after every 5 cards.
    if (next % 5 === 0) {
      setQuizPendingAt(next);
      return;
    }

    if (next >= total) {
      setCardIndex(total);
      setQuizPendingAt(null);
      setReveal(DEFAULT_REVEAL);
      return;
    }

    setCardIndex(next);
    setReveal(DEFAULT_REVEAL);
  }, [cardIndex, total]);

  const handleQuizDone = useCallback(() => {
    const nextIdx = quizPendingAt ?? cardIndex + 1;
    setQuizPendingAt(null);
    if (nextIdx >= total) {
      setCardIndex(total);
    } else {
      setCardIndex(nextIdx);
    }
    setReveal(DEFAULT_REVEAL);
  }, [quizPendingAt, cardIndex, total]);

  const handleRevealTranslation = useCallback(() => {
    setReveal((r) => ({ ...r, translation: true }));
  }, []);

  const handleToggleWordMeanings = useCallback(() => {
    setReveal((r) => ({ ...r, wordMeanings: !r.wordMeanings }));
  }, []);

  const handleToggleGrammar = useCallback(() => {
    setReveal((r) => ({ ...r, grammar: !r.grammar }));
  }, []);

  const handleToggleHint = useCallback(() => {
    setReveal((r) => ({ ...r, hint: !r.hint }));
  }, []);

  const handleGrade = useCallback(
    (grade: CardGrade) => {
      if (!sentenceId || !sentence) return;
      setCardGrades((prev) => new Map(prev).set(sentenceId, grade));

      const familiarity: ItemFamiliarity = grade === "easy" || grade === "correct" ? "known" : "learning";

      setSessionFamiliarity((prev) => {
        const next = new Map(prev);
        for (const w of sentence.words) next.set(w.canonicalKey, familiarity);
        for (const g of sentence.grammar) next.set(g.canonicalKey, familiarity);
        for (const c of sentence.chunks) next.set(c.canonicalKey, familiarity);
        return next;
      });
    },
    [sentence, sentenceId]
  );

  const handleShuffle = useCallback(() => {
    if (!cardOrder.length) return;

    const currentSentenceId = cardOrder[cardIndex] ?? null;
    const shuffled = shuffleIds(cardOrder);
    const reordered = currentSentenceId
      ? [currentSentenceId, ...shuffled.filter((id) => id !== currentSentenceId)]
      : shuffled;

    setCardOrder(reordered);
    setCardIndex(0);
    setQuizPendingAt(null);
    setReveal(DEFAULT_REVEAL);
  }, [cardIndex, cardOrder]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
        case " ":
          e.preventDefault();
          handleRevealTranslation();
          break;
        case "h":
        case "H":
          handleToggleHint();
          break;
        case "w":
        case "W":
          handleToggleWordMeanings();
          break;
        case "g":
        case "G":
          handleToggleGrammar();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext, handleRevealTranslation, handleToggleHint, handleToggleWordMeanings, handleToggleGrammar]);

  async function switchLesson(lessonId: string) {
    setLoadingLesson(true);
    try {
      const selectedLesson = await getLesson(lessonId);
      if (selectedLesson) {
        setLesson(selectedLesson);
        setSelectedLanguage(selectedLesson.language);
        setCardIndex(0);
        setCardOrder(selectedLesson.sentences.map((sentence) => sentence.id));
        setQuizPendingAt(null);
        setReveal(DEFAULT_REVEAL);
        setSessionFamiliarity(new Map());
        setCardGrades(new Map());
      }
    } finally {
      setLoadingLesson(false);
    }
  }

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start studying.</p>
      </section>
    );
  }

  const recentSentences = cardOrder.slice(Math.max(0, cardIndex - 4), cardIndex + 1);
  const recentStudySentences = recentSentences
    .map((id) => sentenceById.get(id))
    .filter((value): value is StudySentence => Boolean(value));

  return (
    <div className="study-shell stack">
      <section className="card stack">
        <div className="row">
          <div>
            <h2>{lesson.title}</h2>
            <p className="muted">Review-style shuffle, summary, and checkpoints built into the lesson library.</p>
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={loadingLesson || !cardOrder.length}
            onClick={handleShuffle}
          >
            Shuffle
          </button>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">Reviewed {summary.reviewed}</span>
          <span className="pill">Remaining {summary.remaining}</span>
          <span className="pill">Easy {summary.easy}</span>
          <span className="pill">Correct {summary.correct}</span>
          <span className="pill">Hard {summary.hard}</span>
          <span className="pill">Failed {summary.failed}</span>
        </div>
      </section>

      {languageGroups.length > 1 ? (
        <section className="card stack language-browser">
          <div className="row">
            <div>
              <h2>Languages</h2>
              <p className="muted">Browse saved lessons by target language.</p>
            </div>
            <span className="pill">{languageGroups.length} languages</span>
          </div>
          <div className="language-tabs">
            {languageGroups.map((group) => (
              <button
                className={group.language === selectedLanguage ? "active" : ""}
                key={group.language}
                type="button"
                disabled={loadingLesson}
                onClick={() => {
                  const nextLesson = group.lessons[0];
                  if (!nextLesson) return;
                  void switchLesson(nextLesson.id);
                }}
              >
                <span>{group.label}</span>
                <small>{group.lessons.length}</small>
              </button>
            ))}
          </div>
          {languageLessons.length > 1 ? (
            <select
              className="input"
              value={lesson.id}
              disabled={loadingLesson}
              onChange={(e) => void switchLesson(e.target.value)}
            >
              {languageLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} ({l.sentenceCount} cards)
                </option>
              ))}
            </select>
          ) : null}
        </section>
      ) : null}

      {quizPendingAt !== null ? (
        <CheckpointQuiz
          sentences={recentStudySentences}
          allSentences={lesson.sentences}
          onComplete={handleQuizDone}
        />
      ) : completed ? (
        <section className="card stack">
          <div className="row">
            <div>
              <h2>Lesson complete</h2>
              <p className="muted">You reached the end of this lesson. Shuffle to start another pass.</p>
            </div>
            <span className="pill">Done</span>
          </div>
          <div className="review-summary">
            <span className="pill">Total {summary.total}</span>
            <span className="pill">Reviewed {summary.reviewed}</span>
            <span className="pill">Remaining {summary.remaining}</span>
          </div>
          <div className="row">
            <button type="button" className="button secondary" onClick={handleShuffle}>
              Shuffle
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                setCardIndex(0);
                setQuizPendingAt(null);
                setReveal(DEFAULT_REVEAL);
              }}
            >
              Restart
            </button>
          </div>
        </section>
      ) : sentence ? (
        <SentenceFlashcard
          key={`${lesson.id}:${sentence.id}:${cardIndex}`}
          sentence={sentence}
          cardIndex={cardIndex}
          totalCards={total}
          lessonTitle={lesson.title}
          language={lesson.language}
          allSentences={lesson.sentences}
          reveal={reveal}
          sessionFamiliarity={sessionFamiliarity}
          currentGrade={cardGrades.get(sentence.id) ?? null}
          onRevealTranslation={handleRevealTranslation}
          onToggleWordMeanings={handleToggleWordMeanings}
          onToggleGrammar={handleToggleGrammar}
          onToggleHint={handleToggleHint}
          onGrade={handleGrade}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      ) : null}
    </div>
  );
}

function shuffleIds(values: string[]): string[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
