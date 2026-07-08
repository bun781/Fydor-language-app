"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import type { StudyLesson, StudyLessonMeta, StudySentence } from "@/lib/imported-content/types";
import { buildClozeCandidates, type ClozeCandidate } from "@/lib/imported-content/study-utils";
import { stableShuffle } from "@/lib/imported-content/stableShuffle";
import { answersMatch, normalizePracticeAnswer } from "@/lib/imported-content/text-spans";
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

type AnswerMode = "type" | "choice";

interface FillBlankCard {
  id: string;
  sentence: StudySentence;
  candidate: ClozeCandidate;
  lessonId: string;
  lessonTitle: string;
}

const RESULTS_KEY = "fydor.fill-blank-test-results";
const DEFAULT_QUESTION_COUNT = 10;
const PROGRESS_KEY = "fill-blank";

interface FillBlankProgress {
  selectedLessonIds: string[];
  questionCount: number;
  testMode: TestMode;
  answerMode: AnswerMode;
  status: TestStatus;
  deck: FillBlankCard[];
  index: number;
  answers: Record<string, string>;
  submittedCards: string[];
  score: { correct: number; wrong: number };
  resultSaved: boolean;
  showResults: boolean;
}

const studySentenceSchema = z.custom<StudySentence>((value) => {
  if (!value || typeof value !== "object") return false;
  const sentence = value as Partial<StudySentence>;
  return (
    typeof sentence.id === "string" &&
    typeof sentence.text === "string" &&
    typeof sentence.translation === "string" &&
    Array.isArray(sentence.words) &&
    Array.isArray(sentence.grammar) &&
    Array.isArray(sentence.chunks)
  );
});

const clozeCandidateSchema = z.custom<ClozeCandidate>((value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ClozeCandidate>;
  return (
    typeof candidate.id === "string" &&
    (candidate.kind === "word" || candidate.kind === "grammar" || candidate.kind === "chunk") &&
    typeof candidate.start === "number" &&
    typeof candidate.end === "number" &&
    typeof candidate.answerText === "string"
  );
});

const fillBlankCardSchema = z.object({
  id: z.string(),
  sentence: studySentenceSchema,
  candidate: clozeCandidateSchema,
  lessonId: z.string(),
  lessonTitle: z.string()
});

const fillBlankProgressSchema = z.object({
  selectedLessonIds: z.array(z.string()),
  questionCount: z.number().int(),
  testMode: z.enum(["continuous", "full"]),
  answerMode: z.enum(["type", "choice"]),
  status: z.enum(["setup", "active", "complete"]),
  deck: z.array(fillBlankCardSchema),
  index: z.number().int(),
  answers: z.record(z.string()),
  submittedCards: z.array(z.string()),
  score: scoreSchema,
  resultSaved: z.boolean(),
  showResults: z.boolean().optional().default(false)
}).transform((item) => ({
  ...item,
  index: Math.min(Math.max(0, item.index), item.deck.length),
  submittedCards: item.submittedCards.filter((id) => item.deck.some((card) => card.id === id))
}));

export function FillBlankMode({ lesson, lessons = [] }: Props) {
  const [initialProgress] = useState(() => readSessionProgress(PROGRESS_KEY, fillBlankProgressSchema));
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
  const [answerMode, setAnswerMode] = useState<AnswerMode>(() => initialProgress?.answerMode ?? "choice");
  const [showResults, setShowResults] = useState(() => initialProgress?.showResults ?? false);
  const [savedResults, setSavedResults] = useState<SavedTestResult[]>(() => readSavedQuizResults(RESULTS_KEY));
  const [deck, setDeck] = useState<FillBlankCard[]>(() => initialProgress?.deck ?? []);
  const [index, setIndex] = useState(() => initialProgress?.index ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => initialProgress?.answers ?? {});
  const [submittedCards, setSubmittedCards] = useState<Set<string>>(() => (
    new Set(initialProgress?.submittedCards ?? [])
  ));
  const [score, setScore] = useState(() => initialProgress?.score ?? { correct: 0, wrong: 0 });
  const [resultSaved, setResultSaved] = useState(() => initialProgress?.resultSaved ?? false);

  const pool = useMemo(() => buildFillBlankDeck(loadedLessons), [loadedLessons]);
  const maxQuestions = Math.max(1, pool.length);
  const clampedQuestionCount = Math.min(Math.max(1, questionCount), maxQuestions);
  const card = deck[index] ?? null;
  const activeAnswer = card ? answers[card.id] ?? "" : "";
  const choices = useMemo(() => buildChoices(card?.candidate.answerText ?? null, deck), [card?.candidate.answerText, deck]);
  const currentSubmitted = Boolean(card && submittedCards.has(card.id));
  const currentResult = card && currentSubmitted
    ? answersMatch(activeAnswer, card.candidate.answerText) ? "correct" : "wrong"
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
      answerMode,
      status,
      deck,
      index,
      answers,
      submittedCards: [...submittedCards],
      score,
      resultSaved,
      showResults
    } satisfies FillBlankProgress);
  }, [answerMode, answers, deck, index, questionCount, resultSaved, score, selectedLessonIds, showResults, status, submittedCards, testMode]);

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
      if (/^[1-9]$/.test(event.key) && !currentSubmitted && answerMode === "choice" && choices.length >= 2) {
        const choice = choices[Number(event.key) - 1];
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
  }, [status, card, currentSubmitted, answerMode, choices, testMode, index, deck.length, confirmExit]);

  if (!availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start Fill Blank.</p>
      </section>
    );
  }

  function startTest() {
    // Re-pick cloze candidates with a per-attempt seed so a repeated test doesn't
    // always blank the exact same span in every sentence.
    const attemptPool = buildFillBlankDeck(loadedLessons, String(Date.now()));
    const nextDeck = sampleDeck(attemptPool, Math.min(clampedQuestionCount, Math.max(1, attemptPool.length)));
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
    if (!card || currentSubmitted) return;
    setAnswers((current) => ({ ...current, [card.id]: value }));
  }

  function submitContinuous(value?: string) {
    if (!card || currentSubmitted) return;
    const selectedAnswer = value ?? activeAnswer;
    if (!selectedAnswer.trim()) return;
    const isCorrect = answersMatch(selectedAnswer, card.candidate.answerText);
    setAnswers((current) => ({ ...current, [card.id]: selectedAnswer }));
    setSubmittedCards((current) => new Set(current).add(card.id));
    setScore((current) => ({
      correct: current.correct + (isCorrect ? 1 : 0),
      wrong: current.wrong + (isCorrect ? 0 : 1)
    }));
  }

  function nextCard() {
    if (index + 1 >= deck.length) finishContinuous();
    else setIndex((current) => current + 1);
  }

  function moveFull(delta: number) {
    setIndex((current) => Math.min(deck.length - 1, Math.max(0, current + delta)));
  }

  function finishFull() {
    const finalScore = calculateScore(deck, answers);
    setScore(finalScore);
    setSubmittedCards(new Set(deck.map((item) => item.id)));
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
            <h2>Fill Blank</h2>
            <p className="muted">{selectedLessonIds.size} lesson{selectedLessonIds.size === 1 ? "" : "s"} selected</p>
          </div>
          <span className="pill">Cloze</span>
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

              <span className="cloze-context-label">Answer style</span>
              <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Answer style">
                <button type="button" role="tab" aria-selected={answerMode === "type"} className={answerMode === "type" ? "active" : ""} onClick={() => setAnswerMode("type")}>
                  Type
                </button>
                <button type="button" role="tab" aria-selected={answerMode === "choice"} className={answerMode === "choice" ? "active" : ""} onClick={() => setAnswerMode("choice")}>
                  Multiple choice
                </button>
              </div>
            </div>
          </div>

          {loadError ? <p className="review-error" role="alert">{loadError}</p> : null}
          {!selectedLessonIds.size ? <p className="muted">Select at least one lesson.</p> : null}
          {selectedLessonIds.size && !pool.length && !loadingLessons ? (
            <p className="muted">The selected lessons need word, grammar, or chunk annotations before they can make fill-in-the-blank cards.</p>
          ) : null}

          <button
            type="button"
            className="button"
            disabled={loadingLessons || !selectedLessonIds.size || !pool.length}
            onClick={startTest}
          >
            {loadingLessons ? "Loading lessons..." : "Start test"}
          </button>

          {showResults ? <PastQuizResults emptyMessage="No completed fill-blank tests yet." results={savedResults} /> : null}
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

      {status === "active" && card ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className={`pill cloze-kind-${card.candidate.kind}`}>{card.candidate.kind}</span>
            <button type="button" className="button secondary" onClick={() => setConfirmExit(true)}>Back</button>
          </div>

          <div className="cloze-context">
            <span className="cloze-context-label">Translation</span>
            <p>{card.sentence.translation}</p>
          </div>

          <div className="cloze-clue-card">
            <span className="cloze-context-label">Clue</span>
            <dl>
              <div>
                <dt>Focus</dt>
                <dd>{formatKind(card.candidate.kind)}</dd>
              </div>
              {card.candidate.meaning ? (
                <div>
                  <dt>Meaning</dt>
                  <dd>{card.candidate.meaning}</dd>
                </div>
              ) : null}
              {card.candidate.explanation ? (
                <div>
                  <dt>Note</dt>
                  <dd>{card.candidate.explanation}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="sentence-line quiz-focus-row">
            <span className="cloze-context-label">Listen</span>
            <AudioButton
              sentence={card.candidate.answerText}
              language={loadedLessons[0]?.language ?? lesson?.language ?? ""}
              compact
              label={`Play ${formatKind(card.candidate.kind)} aloud`}
            />
          </div>

          <p className="sentence-text practice-sentence">
            <span>{card.sentence.text.slice(0, card.candidate.start)}</span>
            <span className={`cloze-blank cloze-kind-${card.candidate.kind}`}>
              {currentSubmitted ? card.candidate.answerText : ""}
            </span>
            <span>{card.sentence.text.slice(card.candidate.end)}</span>
          </p>

          {answerMode === "choice" && choices.length >= 2 ? (
            <div className="cloze-choice-grid">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={[
                    "button secondary cloze-choice",
                    activeAnswer === choice ? "selected" : "",
                    currentSubmitted && answersMatch(choice, card.candidate.answerText) ? "correct" : "",
                    currentSubmitted && activeAnswer === choice && !answersMatch(choice, card.candidate.answerText) ? "incorrect" : ""
                  ].filter(Boolean).join(" ")}
                  disabled={currentSubmitted}
                  onClick={() => testMode === "continuous" ? submitContinuous(choice) : updateAnswer(choice)}
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <div className="practice-answer-row">
              <input
                className="input"
                value={activeAnswer}
                placeholder="Type the missing text"
                disabled={currentSubmitted}
                onChange={(event) => updateAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (testMode === "continuous") submitContinuous();
                    else if (index + 1 >= deck.length) finishFull();
                    else moveFull(1);
                  }
                }}
              />
              {testMode === "continuous" ? (
                <button type="button" className="button secondary" disabled={currentSubmitted} onClick={() => submitContinuous()}>Check</button>
              ) : null}
            </div>
          )}

          {testMode === "continuous" && currentSubmitted ? (
            <div className="stack">
              <p className={`quiz-result ${currentResult === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
                {currentResult === "correct" ? "Correct!" : `Answer: ${card.candidate.answerText}`}
              </p>
              <button type="button" className="button" onClick={nextCard}>
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
            {answerMode === "choice" && choices.length >= 2 ? (
              <><kbd>1</kbd>-<kbd>{Math.min(9, choices.length)}</kbd> answer · </>
            ) : null}
            <kbd>Enter</kbd> next · <kbd>Esc</kbd> exit
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
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="fill-blank-exit-title">
            <h2 id="fill-blank-exit-title">Leave this test?</h2>
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

export function buildFillBlankDeck(lessons: StudyLesson[] | StudyLesson | null, attemptSeed = ""): FillBlankCard[] {
  const lessonList = Array.isArray(lessons) ? lessons : lessons ? [lessons] : [];
  return lessonList.flatMap((item) =>
    item.sentences.flatMap((sentence) => {
      const candidate = pickClozeCandidate(sentence, attemptSeed);
      return candidate ? [{
        id: `${item.id}:${sentence.id}:${candidate.id}`,
        sentence,
        candidate,
        lessonId: item.id,
        lessonTitle: item.title
      }] : [];
    })
  );
}

export function buildChoices(answer: string | null, deck: FillBlankCard[]): string[] {
  if (!answer) return [];
  const seen = new Set([normalizePracticeAnswer(answer)]);
  const distractors: string[] = [];

  for (const card of stableShuffle(deck, answer)) {
    const key = normalizePracticeAnswer(card.candidate.answerText);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(card.candidate.answerText);
  }

  return stableShuffle([answer, ...distractors.slice(0, 3)], answer);
}

function pickClozeCandidate(sentence: StudySentence, attemptSeed = ""): ClozeCandidate | null {
  const candidates = buildClozeCandidates(sentence);
  if (!candidates.length) return null;
  return stableShuffle(candidates, `${sentence.id}${attemptSeed}`)[0];
}

function sampleDeck(deck: FillBlankCard[], count: number): FillBlankCard[] {
  return stableShuffle(deck, `${count}:${deck.map((card) => card.id).join("|")}`).slice(0, count);
}

function calculateScore(deck: FillBlankCard[], answers: Record<string, string>) {
  return deck.reduce(
    (current, card) => {
      if (answersMatch(answers[card.id] ?? "", card.candidate.answerText)) current.correct += 1;
      else current.wrong += 1;
      return current;
    },
    { correct: 0, wrong: 0 }
  );
}

function formatKind(kind: ClozeCandidate["kind"]): string {
  if (kind === "word") return "Vocabulary";
  if (kind === "grammar") return "Grammar pattern";
  return "Chunk / expression";
}
