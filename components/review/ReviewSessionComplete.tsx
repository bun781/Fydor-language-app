// Post-session summary card: recall stats, focus-next actions, weak-lesson pills.
import type { ReviewSourceBucket } from "@/lib/review/sessionSummary";
import type { useReviewDeck } from "@/lib/review/useReviewDeck";

export function ReviewSessionComplete({
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

function StatBlock({ label, value, detail }: { label: string; value: number | string; detail: string }) {
  return (
    <div className="review-complete-stat">
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}
