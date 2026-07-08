// Start-menu building blocks for ReviewDeck: header, quick stats, queue dashboard,
// lesson multi-select, and the pure helpers that derive their numbers.
import { type ReactNode } from "react";
import { CalendarClock, CheckCircle2, HelpCircle, Layers3, Sparkles } from "lucide-react";
import { PieChart } from "@/components/ui/PieChart";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import { buildInterleavedReviewQueue, summarizeReviewSentences } from "@/lib/review/queue";
import type { ReviewSourceBucket } from "@/lib/review/sessionSummary";
import type { ReviewSentence } from "@/lib/review/types";

export type ReviewSummary = ReturnType<typeof summarizeReviewSentences>;

export interface ReviewLessonOption {
  id: string;
  title: string;
}

export function ReviewMenuActions({
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

export function ReviewQuickStats({
  dashboard,
  summary
}: {
  dashboard: ReviewQueueDashboardData;
  summary: ReviewSummary;
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

export function ReviewStartHeader({ summary }: { summary: ReviewSummary }) {
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

export interface ReviewQueueDashboardData {
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

export function ReviewQueueDashboard({ dashboard }: { dashboard: ReviewQueueDashboardData }) {
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

export function ReviewLessonSelect({
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

export function getReviewLessonOptions(lessons: StudyLessonMeta[], sentenceCountByLesson: Map<string, number>): ReviewLessonOption[] {
  if (lessons.length) {
    return lessons.map((lesson) => ({ id: lesson.id, title: lesson.title }));
  }

  return [...sentenceCountByLesson.keys()].map((lessonId, index) => ({
    id: lessonId,
    title: `Lesson ${index + 1}`
  }));
}

export function getSentenceCountByLesson(sentences: ReviewSentence[]) {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (!sentence.lessonId) continue;
    counts.set(sentence.lessonId, (counts.get(sentence.lessonId) ?? 0) + 1);
  }
  return counts;
}

export function summarizeAvailableSentences(sentences: ReviewSentence[], remainingNew?: number) {
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

export function buildQueueDashboard(sentences: ReviewSentence[], remainingNew?: number): ReviewQueueDashboardData {
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

