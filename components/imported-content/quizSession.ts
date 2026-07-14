import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { errorMessage } from "@/lib/errors";
import { getLessonCached } from "@/lib/desktopApi";
import { isEditableShortcutTarget } from "@/lib/dom";
import { clearSessionProgress, readLocal, writeLocal, writeSessionProgress } from "@/lib/storage";
import { stableShuffle } from "@/lib/imported-content/stableShuffle";
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

const savedTestResultSchema = z.object({
  id: z.string(),
  completedAt: z.string(),
  mode: z.enum(["continuous", "full"]),
  lessonTitles: z.array(z.string()),
  questionCount: z.number(),
  correct: z.number(),
  wrong: z.number()
});

function useQuizLessonSelection({
  lesson,
  lessons,
  initialSelectedLessonIds,
  canChangeSelection,
  controlledSelectedLessonIds,
  onSelectedLessonIdsChange
}: {
  lesson: StudyLesson | null;
  lessons: StudyLessonMeta[];
  initialSelectedLessonIds: string[];
  canChangeSelection: boolean;
  controlledSelectedLessonIds?: string[];
  onSelectedLessonIdsChange?: (ids: string[]) => void;
}) {
  const availableLessons = useMemo(() => (
    lessons.length ? lessons : lesson ? [lessonToMeta(lesson)] : []
  ), [lesson, lessons]);
  const [internalSelectedLessonIds, setInternalSelectedLessonIds] = useState<Set<string>>(() => (
    new Set(initialSelectedLessonIds.length ? initialSelectedLessonIds : lesson ? [lesson.id] : [])
  ));
  const selectedLessonIds = useMemo(
    () => new Set(controlledSelectedLessonIds ?? internalSelectedLessonIds),
    [controlledSelectedLessonIds, internalSelectedLessonIds]
  );
  const [loadedLessons, setLoadedLessons] = useState<StudyLesson[]>(() => (lesson ? [lesson] : []));
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!availableLessons.length) {
      if (controlledSelectedLessonIds === undefined) setInternalSelectedLessonIds(new Set());
      return;
    }

    const reconcile = (current: Set<string>) => {
      const validIds = new Set(availableLessons.map((item) => item.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      if (!next.size) next.add(lesson?.id && validIds.has(lesson.id) ? lesson.id : availableLessons[0].id);
      return next;
    };
    if (controlledSelectedLessonIds === undefined) {
      setInternalSelectedLessonIds(reconcile(internalSelectedLessonIds));
    } else if (onSelectedLessonIdsChange) {
      const next = reconcile(selectedLessonIds);
      if (next.size !== selectedLessonIds.size || [...next].some((id) => !selectedLessonIds.has(id))) {
        onSelectedLessonIdsChange([...next]);
      }
    }
  }, [availableLessons, controlledSelectedLessonIds, internalSelectedLessonIds, lesson?.id, onSelectedLessonIdsChange, selectedLessonIds]);

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
        if (!cancelled) setLoadError(errorMessage(err, "Unable to load selected lessons."));
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
    const next = new Set(selectedLessonIds);
    if (next.has(lessonId)) next.delete(lessonId);
    else next.add(lessonId);
    if (controlledSelectedLessonIds !== undefined) onSelectedLessonIdsChange?.([...next]);
    else setInternalSelectedLessonIds(next);
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

function readSavedQuizResults(storageKey: string): SavedTestResult[] {
  return readLocal(storageKey, z.array(savedTestResultSchema)) ?? [];
}

function saveQuizResult(storageKey: string, result: SavedTestResult): SavedTestResult[] {
  const next = [result, ...readSavedQuizResults(storageKey)].slice(0, 20);
  writeLocal(storageKey, next);
  return next;
}

function createResultId() {
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

// ---------------------------------------------------------------------------
// Shared quiz engine used by FillBlankMode and MultipleChoiceMode. Each mode
// supplies its card type, key/correctness functions, and the active-question
// UI; setup/complete/confirm-exit flow, scoring, session persistence, and
// keyboard shortcuts live here so the two modes cannot drift apart.
// ---------------------------------------------------------------------------

export interface QuizScore {
  correct: number;
  wrong: number;
}

export interface QuizProgressBase<TCard> {
  selectedLessonIds: string[];
  questionCount: number;
  testMode: TestMode;
  status: TestStatus;
  deck: TCard[];
  index: number;
  answers: Record<string, string>;
  submittedCards: string[];
  score: QuizScore;
  resultSaved: boolean;
  showResults: boolean;
}

const DEFAULT_QUESTION_COUNT = 10;

export function sampleQuizDeck<TCard>(deck: TCard[], count: number, getKey: (card: TCard) => string): TCard[] {
  return stableShuffle(deck, `${count}:${deck.map(getKey).join("|")}`).slice(0, count);
}

export function useQuizSession<TCard>(cfg: {
  progressKey: string;
  resultsKey: string;
  lesson: StudyLesson | null;
  lessons: StudyLessonMeta[];
  initialProgress: QuizProgressBase<TCard> | null;
  /** Builds the full question pool from the currently loaded lessons. */
  buildPool: (loadedLessons: StudyLesson[]) => TCard[];
  getCardKey: (card: TCard) => string;
  isCorrect: (card: TCard, answer: string) => boolean;
  /** Choices selectable via the 1-9 keys for a card, or null when the user types instead. */
  getHotkeyChoices?: (card: TCard, deck: TCard[]) => string[] | null;
  controlledSelectedLessonIds?: string[];
  onSelectedLessonIdsChange?: (ids: string[]) => void;
  /** Mode-specific fields persisted alongside the base progress (memoize in the caller). */
  extraProgress?: Record<string, unknown>;
}) {
  const { initialProgress, getCardKey, isCorrect } = cfg;
  const [status, setStatus] = useState<TestStatus>(() => initialProgress?.status ?? "setup");
  const selection = useQuizLessonSelection({
    lesson: cfg.lesson,
    lessons: cfg.lessons,
    initialSelectedLessonIds: initialProgress?.selectedLessonIds ?? [],
    canChangeSelection: status === "setup",
    controlledSelectedLessonIds: cfg.controlledSelectedLessonIds,
    onSelectedLessonIdsChange: cfg.onSelectedLessonIdsChange
  });
  const { availableLessons, selectedLessonIds, loadedLessons, loadingLessons } = selection;
  const [questionCount, setQuestionCount] = useState(() => initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT);
  const [questionCountText, setQuestionCountText] = useState(() => String(initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT));
  const [confirmExit, setConfirmExit] = useState(false);
  const [testMode, setTestMode] = useState<TestMode>(() => initialProgress?.testMode ?? "continuous");
  const [showResults, setShowResults] = useState(() => initialProgress?.showResults ?? false);
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => readSavedQuizResults(cfg.resultsKey));
  const [deck, setDeck] = useState<TCard[]>(() => initialProgress?.deck ?? []);
  const [index, setIndex] = useState(() => initialProgress?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialProgress?.answers ?? {});
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(() => new Set(initialProgress?.submittedCards ?? []));
  const [score, setScore] = useState<QuizScore>(() => initialProgress?.score ?? { correct: 0, wrong: 0 });
  const [resultSaved, setResultSaved] = useState(() => initialProgress?.resultSaved ?? false);

  // buildPool is caller-defined and changes identity per render; deliberately depend
  // only on loadedLessons so the pool recomputes when the lessons actually change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => cfg.buildPool(loadedLessons), [loadedLessons]);

  const maxQuestions = Math.max(1, pool.length);
  const clampedQuestionCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const card = deck[index] ?? null;
  const cardKey = card ? getCardKey(card) : "";
  const activeAnswer = cardKey ? answers[cardKey] ?? "" : "";
  const currentSubmitted = Boolean(cardKey && submittedCards.has(cardKey));
  const currentResult: "correct" | "wrong" | null =
    card && currentSubmitted ? (isCorrect(card, activeAnswer) ? "correct" : "wrong") : null;
  const hotkeyChoices = card ? cfg.getHotkeyChoices?.(card, deck) ?? null : null;

  useEffect(() => {
    // Only clamp once the pool has loaded; an empty pool would floor the saved count to 1.
    if (pool.length > 0 && questionCount > pool.length) {
      setQuestionCount(pool.length);
      setQuestionCountText(String(pool.length));
    }
  }, [pool.length, questionCount]);

  useEffect(() => {
    writeSessionProgress(cfg.progressKey, {
      selectedLessonIds: [...selectedLessonIds],
      questionCount,
      testMode,
      status,
      deck,
      index,
      answers,
      submittedCards: [...submittedCards],
      score,
      resultSaved,
      showResults,
      ...cfg.extraProgress
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, deck, index, questionCount, resultSaved, score, selectedLessonIds, showResults, status, submittedCards, testMode, cfg.extraProgress]);

  function startTest(deckOverride?: TCard[]) {
    const nextDeck = deckOverride ?? sampleQuizDeck(pool, clampedQuestionCount, getCardKey);
    if (!nextDeck.length) return;
    setDeck(nextDeck);
    setIndex(0);
    setAnswers({});
    setSubmittedCards(new Set());
    setScore({ correct: 0, wrong: 0 });
    setResultSaved(false);
    setStatus("active");
  }

  function updateAnswer(value: string) {
    if (!cardKey || currentSubmitted) return;
    setAnswers((current) => ({ ...current, [cardKey]: value }));
  }

  function submitContinuous(value?: string) {
    if (!card || !cardKey || currentSubmitted) return;
    const selectedAnswer = value ?? activeAnswer;
    if (!selectedAnswer.trim()) return;
    const correct = isCorrect(card, selectedAnswer);
    setAnswers((current) => ({ ...current, [cardKey]: selectedAnswer }));
    setSubmittedCards((current) => new Set(current).add(cardKey));
    setScore((current) => ({
      correct: current.correct + (correct ? 1 : 0),
      wrong: current.wrong + (correct ? 0 : 1)
    }));
  }

  function nextCard() {
    if (index + 1 >= deck.length) completeTest(score);
    else setIndex((current) => current + 1);
  }

  function moveFull(delta: number) {
    setIndex((current) => Math.min(deck.length - 1, Math.max(0, current + delta)));
  }

  function finishFull() {
    const finalScore = deck.reduce<QuizScore>(
      (current, item) => {
        if (isCorrect(item, answers[getCardKey(item)] ?? "")) current.correct += 1;
        else current.wrong += 1;
        return current;
      },
      { correct: 0, wrong: 0 }
    );
    setScore(finalScore);
    setSubmittedCards(new Set(deck.map(getCardKey)));
    completeTest(finalScore);
  }

  function completeTest(finalScore: QuizScore) {
    if (!resultSaved) {
      const next = saveQuizResult(cfg.resultsKey, {
        id: createResultId(),
        completedAt: new Date().toISOString(),
        mode: testMode,
        lessonTitles: getSelectedLessonTitles(availableLessons, selectedLessonIds),
        questionCount: deck.length,
        correct: finalScore.correct,
        wrong: finalScore.wrong
      });
      setSavedResults(next);
      setResultSaved(true);
    }
    setStatus("complete");
  }

  function onQuestionCountChange(text: string) {
    setQuestionCountText(text);
    const parsed = Number(text);
    if (Number.isInteger(parsed) && parsed >= 1) setQuestionCount(parsed);
  }

  function onQuestionCountBlur() {
    const parsed = Number(questionCountText);
    const clamped = Math.min(Math.max(1, Number.isInteger(parsed) && parsed >= 1 ? parsed : questionCount), maxQuestions);
    setQuestionCount(clamped);
    setQuestionCountText(String(clamped));
  }

  function resetToMenu() {
    clearSessionProgress(cfg.progressKey);
    setConfirmExit(false);
    setStatus("setup");
    setDeck([]);
    setIndex(0);
    setAnswers({});
    setSubmittedCards(new Set());
    setScore({ correct: 0, wrong: 0 });
    setResultSaved(false);
  }

  useEffect(() => {
    if (status === "setup") return;
    function onKeyDown(event: KeyboardEvent) {
      if (isEditableShortcutTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        // Confirm before discarding an in-progress test; one keypress should not destroy a run.
        if (status === "active") setConfirmExit((open) => !open);
        else resetToMenu();
        return;
      }
      if (confirmExit) return;
      if (status !== "active" || !card) return;
      if (/^[1-9]$/.test(event.key) && !currentSubmitted && hotkeyChoices) {
        const choice = hotkeyChoices[Number(event.key) - 1];
        if (choice === undefined) return;
        event.preventDefault();
        if (testMode === "continuous") submitContinuous(choice);
        else updateAnswer(choice);
        return;
      }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        if (testMode === "continuous" && currentSubmitted) {
          event.preventDefault();
          nextCard();
        } else if (testMode === "full") {
          event.preventDefault();
          if (index + 1 >= deck.length) finishFull();
          else moveFull(1);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, card, currentSubmitted, testMode, index, deck.length, confirmExit, hotkeyChoices?.join("|")]);

  return {
    ...selection,
    pool,
    hotkeyChoices,
    status,
    questionCount,
    questionCountText,
    onQuestionCountChange,
    onQuestionCountBlur,
    confirmExit,
    setConfirmExit,
    testMode,
    setTestMode,
    showResults,
    setShowResults,
    savedResults,
    deck,
    index,
    card,
    cardKey,
    activeAnswer,
    currentSubmitted,
    currentResult,
    score,
    maxQuestions,
    clampedQuestionCount,
    loadingLessons,
    startTest,
    updateAnswer,
    submitContinuous,
    nextCard,
    moveFull,
    finishFull,
    resetToMenu
  };
}
