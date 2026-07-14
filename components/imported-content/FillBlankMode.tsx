import { useMemo, useState } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import type { StudyLesson, StudyLessonMeta, StudyPackMeta, StudySentence } from "@/lib/imported-content/types";
import type { StudyScope } from "@/lib/studyScope";
import { resolveStudyScope } from "@/lib/studyScope";
import { buildClozeCandidates, type ClozeCandidate } from "@/lib/imported-content/study-utils";
import { stableShuffle } from "@/lib/imported-content/stableShuffle";
import { answersMatch, normalizePracticeAnswer } from "@/lib/imported-content/text-spans";
import { readSessionProgress } from "@/lib/storage";
import { sampleQuizDeck, scoreSchema, useQuizSession } from "./quizSession";
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
  packs?: StudyPackMeta[];
  studyScope?: StudyScope;
  onStudyScopeChange?: (scope: StudyScope) => void;
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
const PROGRESS_KEY = "fill-blank";

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

export function FillBlankMode({ lesson, lessons = [], packs = [], studyScope, onStudyScopeChange }: Props) {
  const [initialProgress] = useState(() => readSessionProgress(PROGRESS_KEY, fillBlankProgressSchema));
  const [answerMode, setAnswerMode] = useState<AnswerMode>(() => initialProgress?.answerMode ?? "choice");
  const extraProgress = useMemo(() => ({ answerMode }), [answerMode]);
  const quiz = useQuizSession<FillBlankCard>({
    progressKey: PROGRESS_KEY,
    resultsKey: RESULTS_KEY,
    lesson,
    lessons,
    initialProgress,
    buildPool: (loadedLessons) => buildFillBlankDeck(loadedLessons),
    getCardKey: (card) => card.id,
    isCorrect: (card, answer) => answersMatch(answer, card.candidate.answerText),
    getHotkeyChoices: (card, deck) => {
      if (answerMode !== "choice") return null;
      const choices = buildChoices(card.candidate.answerText, deck);
      return choices.length >= 2 ? choices : null;
    },
    controlledSelectedLessonIds: studyScope ? resolveStudyScope(studyScope, lessons, packs) : undefined,
    extraProgress
  });
  const { card, status, score, deck, index, activeAnswer, currentSubmitted, currentResult } = quiz;
  const choices = useMemo(() => buildChoices(card?.candidate.answerText ?? null, deck), [card?.candidate.answerText, deck]);

  if (!quiz.availableLessons.length) {
    return (
      <section className="card stack">
        <p className="muted">No lessons yet. Save a lesson to start Fill Blank.</p>
      </section>
    );
  }

  function startTest() {
    // Re-pick cloze candidates with a per-attempt seed so a repeated test doesn't
    // always blank the exact same span in every sentence.
    const attemptPool = buildFillBlankDeck(quiz.loadedLessons, String(Date.now()));
    const count = Math.min(quiz.clampedQuestionCount, Math.max(1, attemptPool.length));
    quiz.startTest(sampleQuizDeck(attemptPool, count, (item) => item.id));
  }

  return (
    <section className="stack">
      <QuizHeader
        title="Fill Blank"
        badge="Cloze"
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
          packs={packs}
          studyScope={studyScope}
          onStudyScopeChange={onStudyScopeChange}
          questionCountText={quiz.questionCountText}
          maxQuestions={quiz.maxQuestions}
          onQuestionCountChange={quiz.onQuestionCountChange}
          onQuestionCountBlur={quiz.onQuestionCountBlur}
          testMode={quiz.testMode}
          setTestMode={quiz.setTestMode}
          extraControls={
            <>
              <span className="cloze-context-label">Answer style</span>
              <div className="mode-tabs cloze-answer-tabs" role="tablist" aria-label="Answer style">
                <button type="button" role="tab" aria-selected={answerMode === "type"} className={answerMode === "type" ? "active" : ""} onClick={() => setAnswerMode("type")}>
                  Type
                </button>
                <button type="button" role="tab" aria-selected={answerMode === "choice"} className={answerMode === "choice" ? "active" : ""} onClick={() => setAnswerMode("choice")}>
                  Multiple choice
                </button>
              </div>
            </>
          }
          loadError={quiz.loadError}
          poolSize={quiz.pool.length}
          loadingLessons={quiz.loadingLessons}
          emptyPoolMessage="The selected lessons need word, grammar, or chunk annotations before they can make fill-in-the-blank cards."
          onStart={startTest}
          showResults={quiz.showResults}
          setShowResults={quiz.setShowResults}
          savedResults={quiz.savedResults}
          emptyResultsMessage="No completed fill-blank tests yet."
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

      {status === "active" && card ? (
        <section className="card stack quiz-card">
          <div className="row">
            <span className="pill">Question {index + 1} / {deck.length}</span>
            <span className={`pill cloze-kind-${card.candidate.kind}`}>{card.candidate.kind}</span>
            <button type="button" className="button secondary" onClick={() => quiz.setConfirmExit(true)}>Back</button>
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
              language={quiz.loadedLessons[0]?.language ?? lesson?.language ?? ""}
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
                  onClick={() => quiz.testMode === "continuous" ? quiz.submitContinuous(choice) : quiz.updateAnswer(choice)}
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
                onChange={(event) => quiz.updateAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (quiz.testMode === "continuous") quiz.submitContinuous();
                    else if (index + 1 >= deck.length) quiz.finishFull();
                    else quiz.moveFull(1);
                  }
                }}
              />
              {quiz.testMode === "continuous" ? (
                <button type="button" className="button secondary" disabled={currentSubmitted} onClick={() => quiz.submitContinuous()}>Check</button>
              ) : null}
            </div>
          )}

          {quiz.testMode === "continuous" && currentSubmitted && currentResult ? (
            <QuizContinuousFeedback
              result={currentResult}
              answer={card.candidate.answerText}
              isLast={index + 1 >= deck.length}
              onNext={quiz.nextCard}
            />
          ) : null}

          {quiz.testMode === "full" ? (
            <QuizFullModeNav index={index} deckLength={deck.length} onMove={quiz.moveFull} onFinish={quiz.finishFull} />
          ) : null}

          <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
            {answerMode === "choice" && choices.length >= 2 ? (
              <><kbd>1</kbd>-<kbd>{Math.min(9, choices.length)}</kbd> answer · </>
            ) : null}
            <kbd>Enter</kbd> next · <kbd>Esc</kbd> exit
          </p>
        </section>
      ) : null}

      {quiz.confirmExit ? (
        <QuizConfirmExitDialog
          idPrefix="fill-blank"
          onKeep={() => quiz.setConfirmExit(false)}
          onDiscard={quiz.resetToMenu}
        />
      ) : null}
    </section>
  );
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

function formatKind(kind: ClozeCandidate["kind"]): string {
  if (kind === "word") return "Vocabulary";
  if (kind === "grammar") return "Grammar pattern";
  return "Chunk / expression";
}
