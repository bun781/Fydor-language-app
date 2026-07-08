"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, HelpCircle, Layers3, RotateCcw, Sparkles } from "lucide-react";
import { getReviewProgress } from "@/lib/desktopApi";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";
import { createTourScope, replayGuidedTour } from "@/components/system/GuidedTour";
import { PieChart } from "@/components/ui/PieChart";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import { isSpaceKey, shouldIgnoreReviewHotkey, shouldRevealOnSpaceRelease } from "@/lib/review/keyboard";
import { localDayKey, remainingNewCards } from "@/lib/review/progress";
import { buildInterleavedReviewQueue, getReviewShortcutAction, itemTargetToQueueEntry } from "@/lib/review/queue";
import type { ReviewSourceBucket } from "@/lib/review/sessionSummary";
import type { ReviewItemTarget, ReviewProgressSnapshot, ReviewResetScope, ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewProgressPanel } from "./ReviewProgressPanel";
import { ReviewSentenceCard } from "./ReviewSentenceCard";
import { ReviewStatsBrowser } from "./ReviewStatsBrowser";

const REVIEW_REVEAL_PROGRESS_KEY = "review.reveal";

const reviewRevealSchema = z.object({
  sentenceId: z.string().nullable(),
  revealed: z.boolean()
});

interface ReviewLessonOption {
  id: string;
  title: string;
}

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

  if (!sentences.length) {
    if (totalSentenceCount > 0) {
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
              <p className="muted">Select at least one lesson to build a review queue.</p>
            </section>
          )}
        </div>
      );
    }

    return (
      <section className="card review-empty">
        <h2>No sentences to review yet</h2>
        <p className="muted">Import a lesson first, then come back here to review sentences one at a time.</p>
      </section>
    );
  }

  if (!currentSentence) {
    if (!started) {
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
              <ReviewQueueDashboard dashboard={queueDashboard} />
              {progress ? <ReviewProgressPanel progress={progress} /> : null}
            </section>
          )}
          {confirmResetLesson ? (
            <div
              className="confirm-backdrop"
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) setConfirmResetLesson(false);
              }}
            >
              <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-lesson-title">
                <h2 id="reset-lesson-title">Reset Lesson Progress?</h2>
                <p className="muted">This will clear remembered and needs-review status for {selectedLessonTitle}.</p>
                <div className="review-complete-actions">
                  <button type="button" className="button secondary" autoFocus onClick={() => setConfirmResetLesson(false)}>Cancel</button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setConfirmResetLesson(false);
                      void Promise.all(selectedLessonIds.map((lessonId) => handleReset({ type: "lesson", lessonId })));
                    }}
                  >
                    Reset
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      );
    }

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

function ReviewSessionComplete({
  availableBreakdown,
  completedSession,
  lessonTitleById,
  onBack,
  onRetryWeakCards,
  onStartDue,
  onStartMixed,
  onStartNew
}: {
  availableBreakdown: Record<ReviewSourceBucket, number>;
  completedSession: ReturnType<typeof useReviewDeck>["completedSession"];
  lessonTitleById: Map<string, string>;
  onBack: () => void;
  onRetryWeakCards: () => void;
  onStartDue: () => void;
  onStartMixed: () => void;
  onStartNew: () => void;
}) {
  const sessionSummary = completedSession?.summary;

  if (!sessionSummary) {
    return (
      <section className="card review-empty">
        <h2>Review queue complete</h2>
        <p className="muted">This review pass is complete. Start another mixed review whenever you are ready.</p>
        <div className="review-complete-actions">
          <button className="button" type="button" onClick={onStartMixed}>Start Mixed Review</button>
          <button className="button secondary" type="button" onClick={onStartDue} disabled={availableBreakdown.due === 0}>Due only</button>
          <button className="button secondary" type="button" onClick={onStartNew} disabled={availableBreakdown.new === 0}>New only</button>
          <button className="button secondary" type="button" onClick={onBack}>Back</button>
        </div>
      </section>
    );
  }

  const retryDisabled = sessionSummary.retrySentenceIds.length === 0;
  const strongestOutcome = sessionSummary.retrySoon === 0
    ? "Clean pass. Nothing needs an immediate retry."
    : `${sessionSummary.retrySoon} card${sessionSummary.retrySoon === 1 ? "" : "s"} should come back soon.`;

  return (
    <section className="card review-empty review-complete-card">
      <div className="review-complete-header">
        <div>
          <h2>{completedSession.label} complete</h2>
          <p className="muted">Strong recall rate {sessionSummary.strongRecallRate}%. {strongestOutcome}</p>
        </div>
        <span className="pill">Done</span>
      </div>

      <div className="review-summary">
        <span className="pill">Reviewed {sessionSummary.reviewed}</span>
        {sessionSummary.easy > 0 && <span className="pill grade-stat-easy">Easy {sessionSummary.easy}</span>}
        {sessionSummary.remembered > 0 && <span className="pill review-state-remembered">Remembered {sessionSummary.remembered}</span>}
        {sessionSummary.hard > 0 && <span className="pill grade-stat-hard">Hard {sessionSummary.hard}</span>}
        {sessionSummary.forgot > 0 && <span className="pill review-state-forgotten">Forgot {sessionSummary.forgot}</span>}
      </div>

      <div className="review-complete-grid">
        <StatBlock label="Needs another pass" value={sessionSummary.retrySoon} detail="Forgot + hard answers from this pass." />
        <StatBlock label="Recall promoted" value={sessionSummary.promotedRecallModes} detail="Cards pushed to a tougher recall mode." />
        <StatBlock label="Lessons mixed" value={sessionSummary.lessonCount} detail="Distinct lessons practiced in this session." />
        <StatBlock
          label="Queue mix"
          value={`${sessionSummary.dueCount}/${sessionSummary.newCount}/${sessionSummary.masteredCount}`}
          detail="Due / new / mastered cards reviewed."
        />
      </div>

      <div className="review-complete-focus">
        <h3>Focus next</h3>
        <p className="muted">Use the next pass to either clean up weak cards or shift into fresh material.</p>
        <div className="review-complete-actions">
          <button className="button" type="button" onClick={onRetryWeakCards} disabled={retryDisabled}>
            Retry Weak Cards
          </button>
          <button className="button secondary" type="button" onClick={onStartDue} disabled={availableBreakdown.due === 0}>
            Due Only
          </button>
          <button className="button secondary" type="button" onClick={onStartNew} disabled={availableBreakdown.new === 0}>
            New Only
          </button>
          <button className="button secondary" type="button" onClick={onStartMixed}>
            Mixed Again
          </button>
          <button className="button secondary" type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      {sessionSummary.toughestLessons.length > 0 ? (
        <div className="review-complete-focus">
          <h3>Where recall slipped</h3>
          <div className="review-summary">
            {sessionSummary.toughestLessons.map((lesson) => (
              <span className="pill review-state-forgotten" key={lesson.lessonId}>
                {lessonTitleById.get(lesson.lessonId) ?? "Untitled lesson"} {lesson.misses}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ReviewMenuActions({
  statsDisabled,
  onShowStats,
  onHelp
}: {
  statsDisabled: boolean;
  onShowStats: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="review-menu-actions" data-tour="review-start-tabs">
      <button type="button" className="button secondary" data-tour="review-statistics-tab" disabled={statsDisabled} onClick={onShowStats}>
        View all stats
      </button>
      <button type="button" className="icon-button" aria-label="Open review guide" onClick={onHelp}>
        <HelpCircle size={17} />
      </button>
    </div>
  );
}

function ReviewQuickStats({
  dashboard,
  summary
}: {
  dashboard: ReviewQueueDashboardData;
  summary: ReturnType<typeof useReviewDeck>["summary"];
}) {
  const reviewed = Math.max(0, summary.total - summary.unknown);

  return (
    <section className="review-quick-stats" aria-label="Review statistics preview">
      <QuickPieChart
        label="Review balance"
        primary={summary.remembered}
        secondary={dashboard.due}
        primaryLabel="remembered"
        secondaryLabel="due now"
      />
      <QuickPieChart
        label="Queue focus"
        primary={dashboard.due}
        secondary={dashboard.new}
        primaryLabel="due"
        secondaryLabel="new"
        tone="attention"
      />
      <QuickPieChart
        label="Coverage"
        primary={reviewed}
        secondary={summary.unknown}
        primaryLabel="reviewed"
        secondaryLabel="new"
      />
    </section>
  );
}

function QuickPieChart({
  label,
  primary,
  primaryLabel,
  secondary,
  secondaryLabel,
  tone = "balanced"
}: {
  label: string;
  primary: number;
  primaryLabel: string;
  secondary: number;
  secondaryLabel: string;
  tone?: "balanced" | "attention";
}) {
  const total = primary + secondary;
  const primaryShare = total > 0 ? primary / total : 0;
  const percent = total > 0 ? Math.round(primaryShare * 100) : 0;

  return (
    <article className={`review-quick-pie review-quick-pie-${tone}`}>
      <PieChart
        center={<strong>{percent}%</strong>}
        className="review-quick-pie-chart"
        radius={23}
        segments={[
          { value: primary, className: "review-quick-pie-primary" },
          { value: secondary, className: "review-quick-pie-secondary" }
        ]}
        size={72}
        trackClassName="review-quick-pie-track"
      />
      <div className="review-quick-pie-copy">
        <span>{label}</span>
        <strong>{primary} {primaryLabel}</strong>
        <small>{secondary} {secondaryLabel}</small>
      </div>
    </article>
  );
}

function StatBlock({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="review-complete-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function ReviewStartHeader({ summary }: { summary: ReturnType<typeof useReviewDeck>["summary"] }) {
  return (
    <header className="review-header" data-tour="review-start-header">
      <div>
        <h1>Review</h1>
        <p className="muted">Build a mixed queue from due, new, and older mastered sentences.</p>
      </div>
      <div className="review-summary">
        <span className="pill">Total {summary.total}</span>
        <span className="pill">New {summary.unknown}</span>
        <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
        <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
      </div>
    </header>
  );
}

interface ReviewQueueDashboardData {
  due: number;
  // Never-graded cards that can still start today (bounded by the daily new-card cap).
  new: number;
  // All never-graded cards, ignoring the daily cap.
  newTotal: number;
  mastered: number;
  mixedCount: number;
  allCount: number;
  nextDueLabel: string;
}

function ReviewQueueDashboard({ dashboard }: { dashboard: ReviewQueueDashboardData }) {
  const mixedDetail = dashboard.mixedCount === dashboard.allCount
    ? "Mixed will include every selected sentence."
    : `Mixed will start ${dashboard.mixedCount} of ${dashboard.allCount} selected sentences.`;

  return (
    <section className="review-queue-dashboard" aria-label="Review queue dashboard" data-tour="review-queue-dashboard">
      <div className="review-queue-dashboard-top">
        <div>
          <h2>Queue dashboard</h2>
          <p className="muted">{mixedDetail}</p>
        </div>
        <span className="pill">{dashboard.nextDueLabel}</span>
      </div>
      <div className="review-queue-stats">
        <QueueStat icon={<CalendarClock size={18} />} label="Due now" value={dashboard.due} detail="Reviewed cards ready again." />
        <QueueStat
          icon={<Sparkles size={18} />}
          label="New"
          value={dashboard.new}
          detail={dashboard.newTotal > dashboard.new
            ? `${dashboard.newTotal} waiting; daily cap allows ${dashboard.new} more today.`
            : "Cards with no repetitions yet."}
        />
        <QueueStat icon={<CheckCircle2 size={18} />} label="Not due" value={dashboard.mastered} detail="Reviewed cards waiting for later." />
        <QueueStat icon={<Layers3 size={18} />} label="Mixed size" value={dashboard.mixedCount} detail="What Start Mixed Review opens." />
      </div>
    </section>
  );
}

function QueueStat({
  icon,
  label,
  value,
  detail
}: {
  icon: ReactNode;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="review-queue-stat">
      <span className="review-queue-stat-icon" aria-hidden="true">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function ReviewLessonSelect({
  lessons,
  selectedLessonIds,
  sentenceCountByLesson,
  totalSentenceCount,
  onChange
}: {
  lessons: ReviewLessonOption[];
  selectedLessonIds: string[];
  sentenceCountByLesson: Map<string, number>;
  totalSentenceCount: number;
  onChange?: (lessonIds: string[]) => void;
}) {
  if (!lessons.length || !onChange) return null;

  const handleChange = onChange;
  const selected = new Set(selectedLessonIds);
  const allSelected = lessons.length > 0 && lessons.every((lesson) => selected.has(lesson.id));
  const selectedCount = lessons.reduce((count, lesson) => count + (selected.has(lesson.id) ? (sentenceCountByLesson.get(lesson.id) ?? 0) : 0), 0);

  function toggleLesson(lessonId: string) {
    if (selected.has(lessonId)) {
      handleChange(selectedLessonIds.filter((id) => id !== lessonId));
      return;
    }
    handleChange([...selectedLessonIds, lessonId]);
  }

  return (
    <fieldset className="review-lesson-select">
      <div className="review-lesson-select-top">
        <legend>Lessons</legend>
        <span className="muted">{selectedCount} of {totalSentenceCount} sentences</span>
      </div>
      <div className="review-lesson-tools">
        <button className="button secondary" type="button" onClick={() => handleChange(lessons.map((lesson) => lesson.id))} disabled={allSelected}>
          Select all
        </button>
        <button className="button secondary" type="button" onClick={() => handleChange([])} disabled={!selectedLessonIds.length}>
          Clear
        </button>
      </div>
      <div className="review-lesson-checks">
        {lessons.map((lesson) => {
          const count = sentenceCountByLesson.get(lesson.id) ?? 0;
          return (
            <label className="review-lesson-check" key={lesson.id}>
              <input
                type="checkbox"
                checked={selected.has(lesson.id)}
                onChange={() => toggleLesson(lesson.id)}
              />
              <span>
                <strong>{lesson.title}</strong>
                <small>{count} sentences</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function getReviewLessonOptions(lessons: StudyLessonMeta[], sentenceCountByLesson: Map<string, number>): ReviewLessonOption[] {
  if (lessons.length) {
    return lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }));
  }

  return [...sentenceCountByLesson.keys()].map((lessonId, index) => ({
    id: lessonId,
    title: `Lesson ${index + 1}`
  }));
}

function getSentenceCountByLesson(sentences: ReviewSentence[]) {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (!sentence.lessonId) continue;
    counts.set(sentence.lessonId, (counts.get(sentence.lessonId) ?? 0) + 1);
  }
  return counts;
}

function summarizeAvailableSentences(sentences: ReviewSentence[], remainingNew?: number) {
  const now = new Date();
  const totals = sentences.reduce<Record<ReviewSourceBucket, number>>((acc, sentence) => {
    if ((sentence.repetitions ?? 0) === 0) acc.new += 1;
    else if (new Date(sentence.dueAt ?? 0).getTime() <= now.getTime()) acc.due += 1;
    else acc.mastered += 1;
    return acc;
  }, { due: 0, new: 0, mastered: 0 });
  if (remainingNew !== undefined) totals.new = Math.min(totals.new, remainingNew);
  return totals;
}

function buildQueueDashboard(sentences: ReviewSentence[], remainingNew?: number): ReviewQueueDashboardData {
  const now = new Date();
  const available = summarizeAvailableSentences(sentences, remainingNew);
  const newTotal = sentences.filter((sentence) => (sentence.repetitions ?? 0) === 0).length;
  const mixedCount = buildInterleavedReviewQueue(sentences, {
    filter: "mixed",
    seed: 0,
    shuffled: false,
    now,
    newLimit: remainingNew
  }).length;
  const nextDueAt = sentences
    .filter((sentence) => (sentence.repetitions ?? 0) > 0)
    .map((sentence) => sentence.dueAt ? new Date(sentence.dueAt) : null)
    .filter((date): date is Date => date instanceof Date && date.getTime() > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    ...available,
    newTotal,
    mixedCount,
    allCount: sentences.length,
    nextDueLabel: available.due > 0
      ? `${available.due} due now`
      : nextDueAt
        ? `Next due ${formatRelativeDueTime(nextDueAt, now)}`
        : "No scheduled due cards"
  };
}

function formatRelativeDueTime(dueAt: Date, now: Date) {
  const minutes = Math.max(1, Math.ceil((dueAt.getTime() - now.getTime()) / (60 * 1000)));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.ceil(hours / 24);
  return `in ${days}d`;
}
