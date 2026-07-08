"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import type { QuizQuestion, StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { stableShuffle } from "@/lib/imported-content/stableShuffle";
import { buildQuizDeck } from "@/lib/imported-content/study-utils";
import { clearSessionProgress, readSessionProgress, writeSessionProgress } from "@/lib/storage";
import {
  createResultId,
  getSelectedLessonTitles,
  readSavedQuizResults,
  saveQuizResult,
  scoreSchema,
  useQuizLessonSelection,
  type SavedTestResult,
  type TestMode,
  type TestStatus
} from "./quizSession";
import { PastQuizResults } from "./PastQuizResults";
import { z } from "zod";

interface Props {
  lesson: StudyLesson | null;
  lessons?: StudyLessonMeta[];
}

interface MultipleChoiceProgress {
  selectedLessonIds: string[];
  questionCount: number;
  testMode: TestMode;
  status: TestStatus;
  deck: QuizQuestion[];
  index: number;
  answers: Record<string, string>;
  submittedCards: string[];
  score: { correct: number; wrong: number };
  resultSaved: boolean;
  showResults: boolean;
}

const RESULTS_KEY = "fydor.multiple-choice-test-results";
const DEFAULT_QUESTION_COUNT = 10;
const PROGRESS_KEY = "multiple-choice";

const quizQuestionSchema = z.object({
  type: z.enum(["multiple-choice", "fill-blank"]),
  prompt: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string(),
  sentenceId: z.string(),
  focusType: z.enum(["word", "sentence"]).optional(),
  focusText: z.string().optional()
});

const multipleChoiceProgressSchema = z.object({
  selectedLessonIds: z.array(z.string()),
  questionCount: z.number().int(),
  testMode: z.enum(["continuous", "full"]),
  status: z.enum(["setup", "active", "complete"]),
  deck: z.array(quizQuestionSchema),
  index: z.number().int(),
  answers: z.record(z.string()),
  submittedCards: z.array(z.string()),
  score: scoreSchema,
  resultSaved: z.boolean(),
  showResults: z.boolean().optional().default(false)
}).transform((item) => ({
  ...item,
  index: Math.min(Math.max(0, item.index), item.deck.length),
  submittedCards: item.submittedCards.filter((id) => item.deck.some((question) => getQuestionKey(question) === id))
}));

export function MultipleChoiceMode({ lesson, lessons = [] }: Props) {
  const [initialProgress] = useState(() => readSessionProgress(PROGRESS_KEY, multipleChoiceProgressSchema));
  const [status, setStatus] = useState<TestStatus>(() => initialProgress?.status ?? "setup");
  const {
    availableLessons,
    selectedLessonIds,
    loadedLessons,
    loadingLessons,
    loadError,
    toggleLesson
  } = useQuizLessonSelection({
    lesson,
    lessons,
    initialSelectedLessonIds: initialProgress?.selectedLessonIds ?? [],
    canChangeSelection: status === "setup"
  });
  const [questionCount, setQuestionCount] = useState(() => initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT);
  const [questionCountText, setQuestionCountText] = useState(() => String(initialProgress?.questionCount ?? DEFAULT_QUESTION_COUNT));
  const [confirmExit, setConfirmExit] = useState(false);
  const [testMode, setTestMode] = useState<TestMode>(() => initialProgress?.testMode ?? "continuous");
  const [showResults, setShowResults] = useState(() => initialProgress?.showResults ?? false);
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => readSavedQuizResults(RESULTS_KEY));
  const [deck, setDeck] = useState<QuizQuestion[]>(() => initialProgress?.deck ?? []);
  const [index, setIndex] = useState(() => initialProgress?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialProgress?.answers ?? {});
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(() => (
    new Set(initialProgress?.submittedCards ?? [])
  ));
  const [score, setScore] = useState(() => initialProgress?.score ?? { correct: 0, wrong: 0 });
  const [resultSaved, setResultSaved] = useState(() => initialProgress?.resultSaved ?? false);

  const allSentences = useMemo(() => loadedLessons.flatMap((item) => item.sentences), [loadedLessons]);
  const pool = useMemo(() => buildQuizDeck(allSentences, allSentences), [allSentences]);
  const maxQuestions = Math.max(1, pool.length);
  const clampedQuestionCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const question = deck[index] ?? null;
  const questionKey = question ? getQuestionKey(question) : "";
  const activeAnswer = questionKey ? answers[questionKey] ?? "" : "";
  const currentSubmitted = Boolean(questionKey && submittedCards.has(questionKey));
  const currentResult = question && currentSubmitted
    ? normalize(activeAnswer) === normalize(question.answer) ? "correct" : "wrong"
    : null;

  useEffect(() => {
    // Only clamp once the pool has loaded; an empty pool would floor the saved count to 1.
    if (pool.length > 0 && questionCount > pool.length) {
      setQuestionCount(pool.length);
      setQuestionCountText(String(pool.length));
    }
  }, [pool.length, questionCount]);

  useEffect(() => {
    writeSessionProgress(PROGRESS_KEY, {
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
      showResults
    } satisfies MultipleChoiceProgress);
  }, [answers, deck, index, questionCount, resultSaved, score, selectedLessonIds, showResults, status, submittedCards, testMode]);

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
      if (status !== "active" || !question) return;
      if (/^[1-9]$/.test(event.key) && !currentSubmitted && question.options) {
        const option = question.options[Number(event.key) - 1];
        if (option === undefined) return;
        event.preventDefault();
        if (testMode === "continuous") submitContinuous(option);
        else updateAnswer(option);
        return;
      }
      if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        if (testMode === "continuous" && currentSubmitted) {
          event.preventDefault();
          nextQuestion();
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
  }, [status, question, currentSubmitted, testMode, index, deck.length, confirmExit]);

  if (!availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start the multiple-choice mode.</p>
      </section>
    );
  }

  function startTest() {
    const nextDeck = sampleDeck(pool, clampedQuestionCount);
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
    if (!questionKey || currentSubmitted) return;
    setAnswers((current) => ({ ...current, [questionKey]: value }));
  }

  function submitContinuous(value: string) {
    if (!question || !questionKey || currentSubmitted) return;
    const isCorrect = normalize(value) === normalize(question.answer);
    setAnswers((current) => ({ ...current, [questionKey]: value }));
    setSubmittedCards((current) => new Set(current).add(questionKey));
    setScore((current) => ({
      correct: current.correct + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextQuestion() {
    if (index + 1 >= deck.length) finishContinuous();
    else setIndex((current) => current + 1);
  }

  function moveFull(delta: number) {
    setIndex((current) => Math.min(deck.length - 1, Math.max(0, current + delta)));
  }

  function finishFull() {
    const finalScore = calculateScore(deck, answers);
    setScore(finalScore);
    setSubmittedCards(new Set(deck.map(getQuestionKey)));
    completeTest(finalScore);
  }

  function finishContinuous() {
    completeTest(score);
  }

  function completeTest(finalScore: { correct: number; wrong: number }) {
    if (!resultSaved) {
      const next = saveQuizResult(RESULTS_KEY, {
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

  function restartSetup() {
    resetToMenu();
  }

  function resetToMenu() {
    clearSessionProgress(PROGRESS_KEY);
    setConfirmExit(false);
    setStatus("setup");
    setDeck([]);
    setIndex(0);
    setAnswers({});
    setSubmittedCards(new Set());
    setScore({ correct: 0, wrong: 0 });
    setResultSaved(false);
  }

  return (
    <section className="stack">
      <header className="card stack quiz-card">
        <div className="row">
          <div>
            <h2>Multiple Choice</h2>
            <p className="muted">{selectedLessonIds.size} lesson{selectedLessonIds.size === 1 ? "" : "s"} selected</p>
          </div>
          <span className="pill">Recognition</span>
        </div>
        <div className="session-stats">
          <span className="pill">Available {pool.length}</span>
          {status !== "setup" ? <span className="pill">Score {score.correct}/{Math.max(1, score.correct + score.wrong)}</span> : null}
        </div>
      </header>

      {status === "setup" ? (
        <section className="card stack quiz-card">
          <div className="row">
            <h3>Test setup</h3>
            <div className="review-filter-row">
              <button type="button" className="button secondary" onClick={() => setShowResults((value) => !value)}>
                {showResults ? "Hide past test results" : "Statistics"}
              </button>
              <Link className="button secondary" href="/study/imported-content">Back</Link>
            </div>
          </div>

          <div className="test-setup-grid">
            <div className="stack">
              <span className="cloze-context-label">Lessons</span>
              <div className="test-lesson-list">
                {availableLessons.map((item) => (
                  <label className="test-check-row" key={item.id}>
                    <input type="checkbox" checked={selectedLessonIds.has(item.id)} onChange={() => toggleLesson(item.id)} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.sentenceCount} sentences</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="stack">
              <label className="stack">
                <span className="cloze-context-label">Questions</span>
                <input
                  className="input selector-compact"
                  type="number"
                  min={1}
                  max={maxQuestions}
                  value={questionCountText}
                  onChange={(event) => {
                    const text = event.target.value;
                    setQuestionCountText(text);
                    const parsed = Number(text);
                    if (Number.isInteger(parsed) && parsed >= 1) setQuestionCount(parsed);
                  }}
                  onBlur={() => {
                    const parsed = Number(questionCountText);
                    const clamped = Math.min(Math.max(1, Number.isInteger(parsed) && parsed >= 1 ? parsed : questionCount), maxQuestions);
                    setQuestionCount(clamped);
                    setQuestionCountText(String(clamped));
                  }}
                />
              </label>

              <span className="cloze-context-label">Check answers</span>
              <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Test mode">
                <button type="button" role="tab" aria-selected={testMode === "continuous"} className={testMode === "continuous" ? "active" : ""} onClick={() => setTestMode("continuous")}>
                  Continuous
                </button>
                <button type="button" role="tab" aria-selected={testMode === "full"} className={testMode === "full" ? "active" : ""} onClick={() => setTestMode("full")}>
                  Full test
                </button>
              </div>
            </div>
          </div>

          {loadError ? <p className="review-error" role="alert">{loadError}</p> : null}
          {!selectedLessonIds.size ? <p className="muted">Select at least one lesson.</p> : null}
          {selectedLessonIds.size && !pool.length && !loadingLessons ? (
            <p className="muted">The selected lessons do not have enough annotated material yet for a multiple-choice test.</p>
          ) : null}

          <button
            type="button"
            className="button"
            disabled={loadingLessons || !selectedLessonIds.size || !pool.length}
            onClick={startTest}
          >
            {loadingLessons ? "Loading lessons..." : "Start test"}
          </button>

          {showResults ? <PastQuizResults emptyMessage="No completed multiple-choice tests yet." results={savedResults} /> : null}
        </section>
      ) : null}

      {status === "complete" ? (
        <section className="card stack quiz-card">
          <div className="row">
            <h2>Test complete</h2>
            <span className="pill">Saved</span>
          </div>
          <p className="muted">You finished with {score.correct} correct and {score.wrong} missed.</p>
          <div className="session-stats">
            <span className="pill">Questions {deck.length}</span>
            <span className="pill grade-stat-easy">Correct {score.correct}</span>
            <span className="pill grade-stat-again">Missed {score.wrong}</span>
          </div>
          <div className="review-complete-actions">
            <button type="button" className="button" onClick={restartSetup}>New test</button>
            <button type="button" className="button secondary" onClick={resetToMenu}>Back</button>
          </div>
        </section>
      ) : null}

      {status === "active" && question ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className="pill">{question.focusType === "sentence" ? "Translation" : "Vocabulary"}</span>
            <button type="button" className="button secondary" onClick={() => setConfirmExit(true)}>Back</button>
          </div>

          <p className="quiz-prompt">{question.prompt}</p>
          {question.focusText ? (
            <div className="sentence-line quiz-focus-row">
              <p className="quiz-focus-text">{question.focusText}</p>
              <AudioButton
                sentence={question.focusText}
                language={loadedLessons[0]?.language ?? lesson?.language ?? ""}
                compact
                label={`Play ${question.focusType === "word" ? "word" : "sentence"} aloud`}
              />
            </div>
          ) : null}

          {question.options ? (
            <div className="quiz-choices">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    "button secondary quiz-choice",
                    activeAnswer === option ? "selected" : "",
                    currentSubmitted && normalize(option) === normalize(question.answer) ? "quiz-correct" : "",
                    currentSubmitted && normalize(option) === normalize(activeAnswer) && normalize(option) !== normalize(question.answer)
                      ? "quiz-wrong"
                      : ""
                  ].filter(Boolean).join(" ")}
                  disabled={currentSubmitted}
                  onClick={() => testMode === "continuous" ? submitContinuous(option) : updateAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {testMode === "continuous" && currentSubmitted ? (
            <div className="stack">
              <p className={`quiz-result ${currentResult === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {currentResult === "correct" ? "Correct!" : `Answer: ${question.answer}`}
              </p>
              <button type="button" className="button" onClick={nextQuestion}>
                {index + 1 >= deck.length ? "Finish" : "Next"}
              </button>
            </div>
          ) : null}

          {testMode === "full" ? (
            <div className="practice-answer-row">
              <button type="button" className="button secondary" disabled={index === 0} onClick={() => moveFull(-1)}>Back</button>
              {index + 1 >= deck.length ? (
                <button type="button" className="button" onClick={finishFull}>Check test</button>
              ) : (
                <button type="button" className="button" onClick={() => moveFull(1)}>Next</button>
              )}
            </div>
          ) : null}

          <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
            <kbd>1</kbd>-<kbd>{Math.min(9, question.options?.length ?? 4)}</kbd> answer · <kbd>Enter</kbd> next · <kbd>Esc</kbd> exit
          </p>
        </section>
      ) : null}

      {confirmExit ? (
        <div
          className="confirm-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmExit(false);
          }}
        >
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="multiple-choice-exit-title">
            <h2 id="multiple-choice-exit-title">Leave this test?</h2>
            <p className="muted">Your answers so far will be discarded and the test will not be saved.</p>
            <div className="row">
              <button className="button secondary" type="button" autoFocus onClick={() => setConfirmExit(false)}>
                Keep testing
              </button>
              <button className="button danger" type="button" onClick={resetToMenu}>
                Discard test
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function sampleDeck(deck: QuizQuestion[], count: number): QuizQuestion[] {
  return stableShuffle(deck, `${count}:${deck.map(getQuestionKey).join("|")}`).slice(0, count);
}

function calculateScore(deck: QuizQuestion[], answers: Record<string, string>) {
  return deck.reduce(
    (current, question) => {
      if (normalize(answers[getQuestionKey(question)] ?? "") === normalize(question.answer)) current.correct += 1;
      else current.wrong += 1;
      return current;
    },
    { correct: 0, wrong: 0 }
  );
}

function getQuestionKey(question: QuizQuestion) {
  return `${question.sentenceId}:${question.focusType ?? "question"}:${question.answer}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
