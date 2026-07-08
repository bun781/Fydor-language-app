// Shared presentational pieces for the quiz modes (FillBlank, MultipleChoice).
// All state and behavior lives in useQuizSession (quizSession.ts); these render it.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { QuizScore, SavedTestResult, TestMode, TestStatus } from "./quizSession";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PastQuizResults } from "./PastQuizResults";

export function QuizHeader({ title, badge, selectedCount, poolSize, score, status }: {
  title: string;
  badge: string;
  selectedCount: number;
  poolSize: number;
  score: QuizScore;
  status: TestStatus;
}) {
  return (
    <header className="card stack quiz-card">
      <div className="row">
        <div>
          <h2>{title}</h2>
          <p className="muted">{selectedCount} lesson{selectedCount === 1 ? "" : "s"} selected</p>
        </div>
        <span className="pill">{badge}</span>
      </div>
      <div className="session-stats">
        <span className="pill">Available {poolSize}</span>
        {status !== "setup" ? <span className="pill">Score {score.correct}/{Math.max(1, score.correct + score.wrong)}</span> : null}
      </div>
    </header>
  );
}

export function QuizSetupPanel({
  availableLessons, selectedLessonIds, toggleLesson,
  questionCountText, maxQuestions, onQuestionCountChange, onQuestionCountBlur,
  testMode, setTestMode,
  extraControls,
  loadError, poolSize, loadingLessons, emptyPoolMessage,
  onStart,
  showResults, setShowResults, savedResults, emptyResultsMessage
}: {
  availableLessons: StudyLessonMeta[];
  selectedLessonIds: Set<string>;
  toggleLesson: (id: string) => void;
  questionCountText: string;
  maxQuestions: number;
  onQuestionCountChange: (text: string) => void;
  onQuestionCountBlur: () => void;
  testMode: TestMode;
  setTestMode: (mode: TestMode) => void;
  extraControls?: ReactNode;
  loadError: string | null;
  poolSize: number;
  loadingLessons: boolean;
  emptyPoolMessage: string;
  onStart: () => void;
  showResults: boolean;
  setShowResults: (update: (value: boolean) => boolean) => void;
  savedResults: SavedTestResult[];
  emptyResultsMessage: string;
}) {
  return (
    <section className="card stack quiz-card">
      <div className="row">
        <h3>Test setup</h3>
        <div className="review-filter-row">
          <button type="button" className="button secondary" onClick={() => setShowResults((value) => !value)}>
            {showResults ? "Hide past test results" : "Statistics"}
          </button>
          <Link className="button secondary" to="/study/imported-content">Back</Link>
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
              onChange={(event) => onQuestionCountChange(event.target.value)}
              onBlur={onQuestionCountBlur}
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

          {extraControls}
        </div>
      </div>

      {loadError ? <p className="review-error" role="alert">{loadError}</p> : null}
      {!selectedLessonIds.size ? <p className="muted">Select at least one lesson.</p> : null}
      {selectedLessonIds.size && !poolSize && !loadingLessons ? (
        <p className="muted">{emptyPoolMessage}</p>
      ) : null}

      <button
        type="button"
        className="button"
        disabled={loadingLessons || !selectedLessonIds.size || !poolSize}
        onClick={onStart}
      >
        {loadingLessons ? "Loading lessons..." : "Start test"}
      </button>

      {showResults ? <PastQuizResults emptyMessage={emptyResultsMessage} results={savedResults} /> : null}
    </section>
  );
}

export function QuizCompletePanel({ score, questionCount, onRestart, onBack }: {
  score: QuizScore;
  questionCount: number;
  onRestart: () => void;
  onBack: () => void;
}) {
  return (
    <section className="card stack quiz-card">
      <div className="row">
        <h2>Test complete</h2>
        <span className="pill">Saved</span>
      </div>
      <p className="muted">You finished with {score.correct} correct and {score.wrong} missed.</p>
      <div className="session-stats">
        <span className="pill">Questions {questionCount}</span>
        <span className="pill grade-stat-easy">Correct {score.correct}</span>
        <span className="pill grade-stat-again">Missed {score.wrong}</span>
      </div>
      <div className="review-complete-actions">
        <button type="button" className="button" onClick={onRestart}>New test</button>
        <button type="button" className="button secondary" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}

export function QuizConfirmExitDialog({ idPrefix, onKeep, onDiscard }: {
  idPrefix: string;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <ConfirmDialog
      idPrefix={`${idPrefix}-exit`}
      title="Leave this test?"
      description="Your answers so far will be discarded and the test will not be saved."
      cancelLabel="Keep testing"
      confirmLabel="Discard test"
      confirmDanger
      onCancel={onKeep}
      onConfirm={onDiscard}
    />
  );
}

export function QuizContinuousFeedback({ result, answer, isLast, onNext }: {
  result: "correct" | "wrong";
  answer: string;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <div className="stack">
      <p className={`quiz-result ${result === "correct" ? "quiz-result-ok" : "quiz-result-fail"}`}>
        {result === "correct" ? "Correct!" : `Answer: ${answer}`}
      </p>
      <button type="button" className="button" onClick={onNext}>
        {isLast ? "Finish" : "Next"}
      </button>
    </div>
  );
}

export function QuizFullModeNav({ index, deckLength, onMove, onFinish }: {
  index: number;
  deckLength: number;
  onMove: (delta: number) => void;
  onFinish: () => void;
}) {
  return (
    <div className="practice-answer-row">
      <button type="button" className="button secondary" disabled={index === 0} onClick={() => onMove(-1)}>Back</button>
      {index + 1 >= deckLength ? (
        <button type="button" className="button" onClick={onFinish}>Check test</button>
      ) : (
        <button type="button" className="button" onClick={() => onMove(1)}>Next</button>
      )}
    </div>
  );
}
