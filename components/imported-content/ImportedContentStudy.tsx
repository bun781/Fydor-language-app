import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ItemFamiliarity,
  RevealState,
  StudyLesson,
  StudySentence
} from "@/lib/imported-content/types";
import { isEditableShortcutTarget } from "@/lib/dom";
import { CheckpointQuiz } from "./CheckpointQuiz";
import { SentenceFlashcard } from "./SentenceFlashcard";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";

interface Props {
  lesson: StudyLesson | null;
  loadingLesson?: boolean;
  nextLessonTitle?: string;
  onNextLesson?: () => void;
}

const DEFAULT_REVEAL: RevealState = {
  translation: false,
  wordMeanings: false,
  grammar: false,
  hint: false
};

type CardGrade = "easy" | "correct" | "hard" | "failed";

const entrySchema = <T extends z.ZodTypeAny>(value: T) => z.array(z.tuple([z.string(), value]));

const flashcardProgressSchema = z.object({
  cardIndex: z.number().int(),
  cardOrder: z.array(z.string()),
  randomOrderEnabled: z.boolean(),
  quizPendingAt: z.number().int().nullable(),
  reveal: z.object({
    translation: z.boolean(),
    wordMeanings: z.boolean(),
    grammar: z.boolean(),
    hint: z.boolean()
  }),
  sessionFamiliarity: entrySchema(z.enum(["known", "learning"])),
  cardGrades: entrySchema(z.enum(["easy", "correct", "hard", "failed"])),
});

type FlashcardProgress = z.infer<typeof flashcardProgressSchema>;

export function ImportedContentStudy({ lesson: initialLesson, loadingLesson = false, nextLessonTitle, onNextLesson }: Props) {
  const [lesson, setLesson] = useState(initialLesson);
  const [cardIndex, setCardIndex] = useState(0);
  const [cardOrder, setCardOrder] = useState<string[]>(
    () => initialLesson?.sentences.map((s) => s.id) ?? []
  );
  const [randomOrderEnabled, setRandomOrderEnabled] = useState(false);
  const [quizPendingAt, setQuizPendingAt] = useState<number | null>(null);
  const [reveal, setReveal] = useState<RevealState>(DEFAULT_REVEAL);
  const [sessionFamiliarity, setSessionFamiliarity] = useState<Map<string, ItemFamiliarity>>(new Map());
  const [cardGrades, setCardGrades] = useState<Map<string, CardGrade>>(new Map());

  const sentenceById = useMemo(
    () => new Map(lesson?.sentences.map((s) => [s.id, s]) ?? []),
    [lesson]
  );
  const total = cardOrder.length;
  const sentenceId = cardOrder[cardIndex] ?? null;
  const sentence = sentenceId ? sentenceById.get(sentenceId) ?? null : null;
  const completed = total > 0 && cardIndex >= total;

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
    return { total, reviewed: cardGrades.size, remaining: Math.max(0, total - cardGrades.size), easy, correct, hard, failed };
  }, [cardGrades, total]);

  const applySentenceFamiliarity = useCallback((targetSentence: StudySentence, familiarity: ItemFamiliarity) => {
    setSessionFamiliarity((prev) => {
      const next = new Map(prev);
      for (const w of targetSentence.words) next.set(w.canonicalKey, familiarity);
      for (const g of targetSentence.grammar) next.set(g.canonicalKey, familiarity);
      for (const c of targetSentence.chunks) next.set(c.canonicalKey, familiarity);
      return next;
    });
  }, []);

  const handlePrev = useCallback(() => {
    setCardIndex((i) => Math.max(0, i - 1));
    setReveal(DEFAULT_REVEAL);
  }, []);

  const handleNext = useCallback(() => {
    const next = cardIndex + 1;
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
      applySentenceFamiliarity(sentence, familiarity);
    },
    [applySentenceFamiliarity, sentence, sentenceId]
  );

  const resetPass = useCallback((order: string[]) => {
    setCardOrder(order);
    setCardIndex(0);
    setQuizPendingAt(null);
    setReveal(DEFAULT_REVEAL);
    setCardGrades(new Map());
  }, []);

  const handleToggleRandomOrder = useCallback(() => {
    const sourceOrder = lesson?.sentences.map((s) => s.id) ?? [];
    if (!sourceOrder.length) return;
    const nextEnabled = !randomOrderEnabled;
    setRandomOrderEnabled(nextEnabled);
    resetPass(nextEnabled ? shuffleIds(sourceOrder) : sourceOrder);
  }, [lesson, randomOrderEnabled, resetPass]);

  const handleRestart = useCallback(() => {
    const sourceOrder = lesson?.sentences.map((s) => s.id) ?? [];
    if (!sourceOrder.length) return;
    resetPass(randomOrderEnabled ? shuffleIds(sourceOrder) : sourceOrder);
  }, [lesson, randomOrderEnabled, resetPass]);

  useEffect(() => {
    setLesson(initialLesson);
    const restored = initialLesson ? restoreFlashcardProgress(initialLesson) : null;
    setCardIndex(restored?.cardIndex ?? 0);
    setCardOrder(restored?.cardOrder ?? initialLesson?.sentences.map((s) => s.id) ?? []);
    setRandomOrderEnabled(restored?.randomOrderEnabled ?? false);
    setQuizPendingAt(restored?.quizPendingAt ?? null);
    setReveal(restored?.reveal ?? DEFAULT_REVEAL);
    setSessionFamiliarity(new Map(restored?.sessionFamiliarity ?? []));
    setCardGrades(new Map(restored?.cardGrades ?? []));
  }, [initialLesson]);

  useEffect(() => {
    if (!lesson) return;
    writeSessionProgress(getFlashcardProgressKey(lesson.id), {
      cardIndex,
      cardOrder,
      randomOrderEnabled,
      quizPendingAt,
      reveal,
      sessionFamiliarity: Array.from(sessionFamiliarity.entries()),
      cardGrades: Array.from(cardGrades.entries())
    } satisfies FlashcardProgress);
  }, [cardGrades, cardIndex, cardOrder, lesson, quizPendingAt, randomOrderEnabled, reveal, sessionFamiliarity]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isEditableShortcutTarget(e.target)) return;
      // Grade shortcuts (1-4) mirror the Review screen's ordering: Again, Hard, Good, Easy.
      if (quizPendingAt === null && /^[1-4]$/.test(e.key)) {
        const grade = (["failed", "hard", "correct", "easy"] as const)[Number(e.key) - 1];
        handleGrade(grade);
        return;
      }
      switch (e.key) {
        case "ArrowLeft": handlePrev(); break;
        case "ArrowRight": handleNext(); break;
        case " ": e.preventDefault(); handleRevealTranslation(); break;
        case "h": case "H": handleToggleHint(); break;
        case "w": case "W": handleToggleWordMeanings(); break;
        case "g": case "G": handleToggleGrammar(); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlePrev, handleNext, handleRevealTranslation, handleToggleHint, handleToggleWordMeanings, handleToggleGrammar, handleGrade, quizPendingAt]);

  if (!lesson) {
    return (
      <section className="card stack">
        <p className="muted">
          {loadingLesson ? "Loading selected lesson..." : "Select a lesson to start studying."}
        </p>
      </section>
    );
  }

  const recentSentences = cardOrder.slice(Math.max(0, cardIndex - 4), cardIndex + 1);
  const recentStudySentences = recentSentences
    .map((id) => sentenceById.get(id))
    .filter((v): v is StudySentence => Boolean(v));

  return (
    <div className="study-shell stack">
      <div className="lesson-selector-bar">
        <div className="session-stats">
          <span className="pill">{summary.remaining > 0 ? `${summary.remaining} remaining` : "Done"}</span>
          {summary.easy > 0 && <span className="pill grade-stat-easy">Easy {summary.easy}</span>}
          {summary.correct > 0 && <span className="pill grade-stat-good">Good {summary.correct}</span>}
          {summary.hard > 0 && <span className="pill grade-stat-hard">Hard {summary.hard}</span>}
          {summary.failed > 0 && <span className="pill grade-stat-again">Again {summary.failed}</span>}
        </div>
      </div>

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
              <p className="muted">You reached the end. Random order can be toggled for the next pass.</p>
            </div>
            <span className="pill">Done</span>
          </div>
          <div className="session-stats">
            <span className="pill">Total {summary.total}</span>
            {summary.easy > 0 && <span className="pill grade-stat-easy">Easy {summary.easy}</span>}
            {summary.correct > 0 && <span className="pill grade-stat-good">Good {summary.correct}</span>}
            {summary.hard > 0 && <span className="pill grade-stat-hard">Hard {summary.hard}</span>}
            {summary.failed > 0 && <span className="pill grade-stat-again">Again {summary.failed}</span>}
          </div>
          <div className="row compact-row" style={{ gap: 8 }}>
            <button
              type="button"
              className="button"
              onClick={handleRestart}
            >
              Restart
            </button>
            <button
              type="button"
              className={`button secondary random-order-toggle${randomOrderEnabled ? " active" : ""}`}
              onClick={handleToggleRandomOrder}
              aria-pressed={randomOrderEnabled}
              title={randomOrderEnabled ? "Random order on" : "Random order off"}
            >
              Random order {randomOrderEnabled ? "On" : "Off"}
            </button>
            {onNextLesson && nextLessonTitle ? <button type="button" className="button secondary" onClick={onNextLesson}>Next lesson: {nextLessonTitle}</button> : null}
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
          randomOrderEnabled={randomOrderEnabled}
          onToggleRandomOrder={handleToggleRandomOrder}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      ) : null}
    </div>
  );
}

function shuffleIds(values: string[]): string[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.length > 1 && copy.every((id, index) => id === values[index])) {
    copy.push(copy.shift() as string);
  }
  return copy;
}

function restoreFlashcardProgress(lesson: StudyLesson): FlashcardProgress | null {
  const saved = readSessionProgress(getFlashcardProgressKey(lesson.id), flashcardProgressSchema);
  if (!saved) return null;

  const sentenceIds = new Set(lesson.sentences.map((sentence) => sentence.id));
  const cardOrder = [
    ...saved.cardOrder.filter((id) => sentenceIds.has(id)),
    ...lesson.sentences.map((sentence) => sentence.id).filter((id) => !saved.cardOrder.includes(id))
  ];
  const maxIndex = cardOrder.length;

  return {
    ...saved,
    cardIndex: Math.min(Math.max(0, saved.cardIndex), maxIndex),
    cardOrder,
    quizPendingAt:
      saved.quizPendingAt === null
        ? null
        : Math.min(Math.max(0, saved.quizPendingAt), maxIndex),
    sessionFamiliarity: saved.sessionFamiliarity.filter(([key]) => Boolean(key)),
    cardGrades: saved.cardGrades.filter(([id]) => sentenceIds.has(id))
  };
}

function getFlashcardProgressKey(lessonId: string) {
  return `flashcards.${lessonId}`;
}
