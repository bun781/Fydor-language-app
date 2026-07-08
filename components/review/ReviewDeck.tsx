import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { getReviewProgress } from "@/lib/desktopApi";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";
import { createTourScope, replayGuidedTour } from "@/components/system/GuidedTour";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { getReviewShortcutAction, isSpaceKey, shouldIgnoreReviewHotkey, shouldRevealOnSpaceRelease } from "@/lib/review/keyboard";
import { localDayKey, remainingNewCards } from "@/lib/review/progress";
import { itemTargetToQueueEntry } from "@/lib/review/queue";
import type { ReviewItemTarget, ReviewProgressSnapshot, ReviewResetScope, ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewProgressPanel } from "./ReviewProgressPanel";
import { ReviewSentenceCard } from "./ReviewSentenceCard";
import { ReviewSessionComplete } from "./ReviewSessionComplete";
import {
  ReviewLessonSelect,
  ReviewMenuActions,
  ReviewQuickStats,
  ReviewQueueDashboard,
  ReviewStartHeader,
  buildQueueDashboard,
  getReviewLessonOptions,
  getSentenceCountByLesson,
  summarizeAvailableSentences
} from "./ReviewStartPanels";
import { ReviewStatsBrowser } from "./ReviewStatsBrowser";

const REVIEW_REVEAL_PROGRESS_KEY = "review.reveal";

const reviewRevealSchema = z.object({
  sentenceId: z.string().nullable(),
  revealed: z.boolean()
});

interface ReviewDeckProps {
  allSentenceCount?: number;
  lessons?: StudyLessonMeta[];
  fullLessons?: StudyLesson[];
  sentenceCountByLesson?: Map<string, number>;
  selectedLessonIds?: string[];
  sentences: ReviewSentence[];
  items?: ReviewItemTarget[];
  onSelectedLessonIdsChange?: (lessonIds: string[]) => void;
  onResetProgress?: (scope: ReviewResetScope) => Promise<void> | void;
}

const NO_ITEMS: ReviewItemTarget[] = [];

export function ReviewDeck({
  sentences,
  items = NO_ITEMS,
  allSentenceCount,
  fullLessons = [],
  lessons = [],
  sentenceCountByLesson,
  selectedLessonIds = lessons.map((lesson) => lesson.id),
  onSelectedLessonIdsChange,
  onResetProgress
}: ReviewDeckProps) {
  const totalSentenceCount = allSentenceCount ?? sentences.length;
  const lessonSentenceCounts = sentenceCountByLesson ?? getSentenceCountByLesson(sentences);
  const lessonOptions = getReviewLessonOptions(lessons, lessonSentenceCounts);
  // Stable identity matters: useReviewDeck resets deck state when its input array changes.
  const reviewTargets = useMemo(
    () => [...sentences, ...items.map(itemTargetToQueueEntry)],
    [sentences, items]
  );
  // Progress is additive: the deck works without it, but while it is loaded the daily
  // new-card cap bounds how many first-time cards a session can introduce.
  const [progress, setProgress] = useState<ReviewProgressSnapshot | null>(null);
  const remainingNew = progress ? remainingNewCards(progress.dailyActivity, localDayKey()) : undefined;
  const {
    currentSentence,
    position,
    queueTotal,
    saving,
    error,
    reviewCurrent,
    summary,
    started,
    startReview,
    startFocusedReview,
    returnToMenu,
    completedSession
  } = useReviewDeck(reviewTargets, { newLimit: remainingNew });
  const [revealed, setRevealed] = useState(false);
  const [menuView, setMenuView] = useState<"start" | "statistics">("start");
  const [confirmResetLesson, setConfirmResetLesson] = useState(false);
  const spacePressSentenceIdRef = useRef<string | null>(null);
  const availableBreakdown = summarizeAvailableSentences(reviewTargets, remainingNew);
  const queueDashboard = buildQueueDashboard(reviewTargets, remainingNew);
  const lessonTitleById = new Map(lessonOptions.map((lesson) => [lesson.id, lesson.title]));

  // Refresh the progress snapshot whenever the menu is (re)shown, so a finished
  // session is reflected in the streak, heatmap, and remaining new-card budget.
  useEffect(() => {
    if (started) return;
    let cancelled = false;
    getReviewProgress()
      .then((snapshot) => {
        if (!cancelled) setProgress(snapshot);
      })
      .catch(() => {
        // Progress is additive; the deck must keep working without it.
      });
    return () => {
      cancelled = true;
    };
  }, [started]);

  useEffect(() => {
    const saved = readSessionProgress(REVIEW_REVEAL_PROGRESS_KEY, reviewRevealSchema);
    setRevealed(Boolean(saved?.revealed && saved.sentenceId === (currentSentence?.id ?? null)));
    spacePressSentenceIdRef.current = null;
  }, [currentSentence?.id]);

  useEffect(() => {
    writeSessionProgress(REVIEW_REVEAL_PROGRESS_KEY, {
      sentenceId: currentSentence?.id ?? null,
      revealed
    } satisfies z.infer<typeof reviewRevealSchema>);
  }, [currentSentence?.id, revealed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreReviewHotkey(event)) return;
      if (!started) return;
      if (isSpaceKey(event.key)) {
        event.preventDefault();
        spacePressSentenceIdRef.current = currentSentence?.id ?? null;
        return;
      }

      const decision = getReviewShortcutAction(event.key);
      if (decision && revealed) {
        event.preventDefault();
        void reviewCurrent(decision);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setRevealed(false);
        returnToMenu();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (shouldIgnoreReviewHotkey(event)) return;
      if (!started) return;
      if (!isSpaceKey(event.key)) return;

      event.preventDefault();
      if (!revealed && shouldRevealOnSpaceRelease(spacePressSentenceIdRef.current, currentSentence?.id ?? null)) {
        setRevealed(true);
      }
      spacePressSentenceIdRef.current = null;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentSentence?.id, revealed, returnToMenu, reviewCurrent, started]);

  useEffect(() => {
    if (!confirmResetLesson) return;
    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmResetLesson(false);
    }
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [confirmResetLesson]);

  function handleBackToMenu() {
    setRevealed(false);
    setMenuView("start");
    returnToMenu();
  }

  async function handleReset(scope: ReviewResetScope) {
    await onResetProgress?.(scope);
    setRevealed(false);
    returnToMenu();
  }

  const selectedLessonTitle = selectedLessonIds.length === 1
    ? lessonTitleById.get(selectedLessonIds[0]) ?? "selected lesson"
    : `${selectedLessonIds.length} selected lessons`;

  // Start menu for both the "lessons selected but no sentences" and the normal
  // pre-session state; the dashboards only make sense once sentences exist.
  function renderStartMenu(hasSentences: boolean) {
    return (
      <div className="review-shell">
        <ReviewStartHeader summary={summary} />
        {menuView === "statistics" && onResetProgress ? (
          <>
            <button className="button secondary review-back-button" type="button" onClick={() => setMenuView("start")}>
              Back to review setup
            </button>
            <ReviewStatsBrowser
              lessons={fullLessons}
              lessonTitleById={lessonTitleById}
              sentences={sentences}
              onReset={handleReset}
            />
          </>
        ) : (
          <section className="review-start-panel review-start-panel-controls">
            <div className="review-start-actions">
              <button className="button" type="button" data-tour="review-start-mixed" onClick={() => startReview("mixed")}>
                Start Mixed Review
              </button>
              <div className="review-filter-row" aria-label="Review filters">
                <button className="button secondary" type="button" data-tour="review-start-due" onClick={() => startReview("due")} disabled={queueDashboard.due === 0}>Due only</button>
                <button className="button secondary" type="button" data-tour="review-start-new" onClick={() => startReview("new")} disabled={queueDashboard.new === 0}>New only</button>
                <button className="button secondary" type="button" onClick={() => startReview("all")}>All selected</button>
                {onResetProgress && selectedLessonIds.length ? (
                  <button className="button secondary" type="button" data-tour="review-reset-progress" onClick={() => setConfirmResetLesson(true)}>
                    <RotateCcw size={16} /> Reset Progress
                  </button>
                ) : null}
              </div>
            </div>
            <ReviewLessonSelect
              lessons={lessonOptions}
              selectedLessonIds={selectedLessonIds}
              sentenceCountByLesson={lessonSentenceCounts}
              totalSentenceCount={totalSentenceCount}
              onChange={onSelectedLessonIdsChange}
            />
            <ReviewMenuActions
              statsDisabled={!onResetProgress}
              onShowStats={() => setMenuView("statistics")}
              onHelp={() => replayGuidedTour(createTourScope("/review", "start"))}
            />
            <ReviewQuickStats summary={summary} dashboard={queueDashboard} />
            {hasSentences ? (
              <>
                <ReviewQueueDashboard dashboard={queueDashboard} />
                {progress ? <ReviewProgressPanel progress={progress} /> : null}
              </>
            ) : (
              <p className="muted">Select at least one lesson to build a review queue.</p>
            )}
          </section>
        )}
        {confirmResetLesson ? (
          <ConfirmDialog
            idPrefix="reset-lesson"
            title="Reset Lesson Progress?"
            description={<>This will clear remembered and needs-review status for {selectedLessonTitle}.</>}
            cancelLabel="Cancel"
            confirmLabel="Reset"
            actionsClassName="review-complete-actions"
            onCancel={() => setConfirmResetLesson(false)}
            onConfirm={() => {
              setConfirmResetLesson(false);
              void Promise.all(selectedLessonIds.map((lessonId) => handleReset({ type: "lesson", lessonId })));
            }}
          />
        ) : null}
      </div>
    );
  }

  if (!sentences.length) {
    if (totalSentenceCount > 0) return renderStartMenu(false);

    return (
      <section className="card review-empty">
        <h2>No sentences to review yet</h2>
        <p className="muted">Import a lesson first, then come back here to review sentences one at a time.</p>
      </section>
    );
  }

  if (!currentSentence) {
    if (!started) return renderStartMenu(true);

    return (
      <ReviewSessionComplete
        availableBreakdown={availableBreakdown}
        completedSession={completedSession}
        lessonTitleById={lessonTitleById}
        onRetryWeakCards={() => {
          if (!completedSession?.summary.retrySentenceIds.length) return;
          startFocusedReview(completedSession.summary.retrySentenceIds, "Weak-card retry");
        }}
        onStartDue={() => startReview("due")}
        onStartMixed={() => startReview("mixed")}
        onStartNew={() => startReview("new")}
        onBack={handleBackToMenu}
      />
    );
  }

  return (
    <div className="review-shell">
      <header className="review-header" data-tour="review-queue-dashboard">
        <div>
          <h1>Review</h1>
          <p className="muted">Recall before reveal. Space reveals; grade only after the answer is visible.</p>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">New {summary.unknown}</span>
          <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
          <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
        </div>
      </header>
      <button className="button secondary review-back-button" type="button" data-tour="review-back-button" onClick={handleBackToMenu}>
        Back
      </button>

      {error ? <p className="review-error" role="alert">{error}</p> : null}

      <ReviewSentenceCard
        sentence={currentSentence}
        index={position}
        total={queueTotal}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      <ReviewControls
        disabled={saving}
        visible={revealed}
        onForgot={() => reviewCurrent("forgot")}
        onHard={() => reviewCurrent("hard")}
        onRemembered={() => reviewCurrent("remembered")}
        onEasy={() => reviewCurrent("easy")}
      />
    </div>
  );
}

