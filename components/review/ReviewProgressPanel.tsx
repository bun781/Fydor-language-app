import { CalendarDays, Flame, Sparkles, Trophy } from "lucide-react";
import {
  buildHeatmapCells,
  computeReviewStreaks,
  DEFAULT_NEW_CARDS_PER_DAY,
  localDayKey,
  masteryPercent,
  newCardsIntroducedOn
} from "@/lib/review/progress";
import type { ReviewMasteryStats, ReviewProgressSnapshot } from "@/lib/review/types";

const HEATMAP_DAYS = 84;

export function ReviewProgressPanel({ progress }: { progress: ReviewProgressSnapshot }) {
  const today = localDayKey();
  const streaks = computeReviewStreaks(progress.dailyActivity, today);
  const cells = buildHeatmapCells(progress.dailyActivity, today, HEATMAP_DAYS);
  const reviewsToday = progress.dailyActivity.find((entry) => entry.day === today)?.reviews ?? 0;
  const newToday = newCardsIntroducedOn(progress.dailyActivity, today);

  return (
    <section className="review-progress-panel" aria-label="Review progress">
      <div className="review-progress-stats">
        <ProgressStat
          icon={<Flame size={18} />}
          label="Streak"
          value={`${streaks.current}d`}
          detail={streaks.longest > streaks.current ? `Longest ${streaks.longest} days.` : "Your longest streak yet."}
        />
        <ProgressStat
          icon={<CalendarDays size={18} />}
          label="Today"
          value={reviewsToday.toString()}
          detail="Cards graded today."
        />
        <ProgressStat
          icon={<Sparkles size={18} />}
          label="New today"
          value={`${newToday}/${DEFAULT_NEW_CARDS_PER_DAY}`}
          detail="First-time cards against the daily cap."
        />
        <ProgressStat
          icon={<Trophy size={18} />}
          label="Item mastery"
          value={`${masteryPercent(progress.itemStats)}%`}
          detail={`${progress.itemStats.mastered} of ${progress.itemStats.total} items mastered.`}
        />
      </div>

      <div className="review-heatmap" role="img" aria-label="Review activity for the last 12 weeks">
        {cells.map((cell) => (
          <span
            key={cell.day}
            className={`review-heatmap-cell review-heatmap-${cell.intensity}`}
            title={`${cell.day}: ${cell.reviews} review${cell.reviews === 1 ? "" : "s"}${cell.newCards ? `, ${cell.newCards} new` : ""}`}
          />
        ))}
      </div>

      <div className="review-mastery-bars">
        <MasteryBar label="Items" stats={progress.itemStats} />
        <MasteryBar label="Sentences" stats={progress.sentenceStats} />
      </div>
    </section>
  );
}

function ProgressStat({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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

function MasteryBar({ label, stats }: { label: string; stats: ReviewMasteryStats }) {
  const masteredPercent = masteryPercent(stats);
  const gradedPercent = stats.total > 0 ? Math.round((stats.graded / stats.total) * 100) : 0;

  return (
    <div className="review-mastery-bar">
      <div className="review-mastery-bar-top">
        <span>{label}</span>
        <small className="muted">{stats.mastered} mastered · {stats.graded} graded · {stats.total} total</small>
      </div>
      <div className="review-mastery-track" role="progressbar" aria-valuenow={masteredPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} mastered`}>
        <span className="review-mastery-graded" style={{ width: `${gradedPercent}%` }} />
        <span className="review-mastery-fill" style={{ width: `${masteredPercent}%` }} />
      </div>
    </div>
  );
}
