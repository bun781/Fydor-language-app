import { useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import type { QuizQuestion, StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { buildQuizDeck } from "@/lib/imported-content/study-utils";
import { readSessionProgress } from "@/lib/storage";
import { scoreSchema, useQuizSession } from "./quizSession";
import {
  QuizCompletePanel,
  QuizConfirmExitDialog,
  QuizContinuousFeedback,
  QuizFullModeNav,
  QuizHeader,
  QuizSetupPanel
} from "./QuizShell";
import { z } from "zod";

interface Props {
  lesson: StudyLesson | null;
  lessons?: StudyLessonMeta[];
}

const RESULTS_KEY = "fydor.multiple-choice-test-results";
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
  const quiz = useQuizSession<QuizQuestion>({
    progressKey: PROGRESS_KEY,
    resultsKey: RESULTS_KEY,
    lesson,
    lessons,
    initialProgress,
    buildPool: (loadedLessons) => {
      const allSentences = loadedLessons.flatMap((item) => item.sentences);
      return buildQuizDeck(allSentences, allSentences);
    },
    getCardKey: getQuestionKey,
    isCorrect: (question, answer) => normalize(answer) === normalize(question.answer),
    getHotkeyChoices: (question) => question.options ?? null
  });
  const { card: question, status, score, deck, index, activeAnswer, currentSubmitted, currentResult } = quiz;

  if (!quiz.availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start the multiple-choice mode.</p>
      </section>
    );
  }

  return (
    <section className="stack">
      <QuizHeader
        title="Multiple Choice"
        badge="Recognition"
        selectedCount={quiz.selectedLessonIds.size}
        poolSize={quiz.pool.length}
        score={score}
        status={status}
      />

      {status === "setup" ? (
        <QuizSetupPanel
          availableLessons={quiz.availableLessons}
          selectedLessonIds={quiz.selectedLessonIds}
          toggleLesson={quiz.toggleLesson}
          questionCountText={quiz.questionCountText}
          maxQuestions={quiz.maxQuestions}
          onQuestionCountChange={quiz.onQuestionCountChange}
          onQuestionCountBlur={quiz.onQuestionCountBlur}
          testMode={quiz.testMode}
          setTestMode={quiz.setTestMode}
          loadError={quiz.loadError}
          poolSize={quiz.pool.length}
          loadingLessons={quiz.loadingLessons}
          emptyPoolMessage="The selected lessons do not have enough annotated material yet for a multiple-choice test."
          onStart={() => quiz.startTest()}
          showResults={quiz.showResults}
          setShowResults={quiz.setShowResults}
          savedResults={quiz.savedResults}
          emptyResultsMessage="No completed multiple-choice tests yet."
        />
      ) : null}

      {status === "complete" ? (
        <QuizCompletePanel
          score={score}
          questionCount={deck.length}
          onRestart={quiz.resetToMenu}
          onBack={quiz.resetToMenu}
        />
      ) : null}

      {status === "active" && question ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className="pill">{question.focusType === "sentence" ? "Translation" : "Vocabulary"}</span>
            <button type="button" className="button secondary" onClick={() => quiz.setConfirmExit(true)}>Back</button>
          </div>

          <p className="quiz-prompt">{question.prompt}</p>
          {question.focusText ? (
            <div className="sentence-line quiz-focus-row">
              <p className="quiz-focus-text">{question.focusText}</p>
              <AudioButton
                sentence={question.focusText}
                language={quiz.loadedLessons[0]?.language ?? lesson?.language ?? ""}
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
                  onClick={() => quiz.testMode === "continuous" ? quiz.submitContinuous(option) : quiz.updateAnswer(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          {quiz.testMode === "continuous" && currentSubmitted && currentResult ? (
            <QuizContinuousFeedback
              result={currentResult}
              answer={question.answer}
              isLast={index + 1 >= deck.length}
              onNext={quiz.nextCard}
            />
          ) : null}

          {quiz.testMode === "full" ? (
            <QuizFullModeNav index={index} deckLength={deck.length} onMove={quiz.moveFull} onFinish={quiz.finishFull} />
          ) : null}

          <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
            <kbd>1</kbd>-<kbd>{Math.min(9, question.options?.length ?? 4)}</kbd> answer · <kbd>Enter</kbd> next · <kbd>Esc</kbd> exit
          </p>
        </section>
      ) : null}

      {quiz.confirmExit ? (
        <QuizConfirmExitDialog
          idPrefix="multiple-choice"
          onKeep={() => quiz.setConfirmExit(false)}
          onDiscard={quiz.resetToMenu}
        />
      ) : null}
    </section>
  );
}

function getQuestionKey(question: QuizQuestion) {
  return `${question.sentenceId}:${question.focusType ?? "question"}:${question.answer}`;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
