"use client";

import { AudioButton } from "@/components/ui/AudioButton";
import type { ReviewSentence } from "@/lib/review/types";

interface ReviewSentenceCardProps {
  sentence: ReviewSentence;
  index: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
}

export function ReviewSentenceCard({ sentence, index, total, revealed, onReveal }: ReviewSentenceCardProps) {
  const revealInstruction = "Click or press Space to reveal translation";

  return (
    <section className="review-card">
      <div className="review-card-meta">
        <span className="pill">Sentence {index + 1} of {total}</span>
        <span className={`pill review-state-${sentence.reviewState}`}>{sentence.reviewState}</span>
      </div>
      <div className="review-sentence-row">
        <p className="review-sentence">{sentence.text}</p>
        <AudioButton sentence={sentence.text} language={sentence.language} compact />
      </div>
      <div
        className={`review-translation-wrap${revealed ? " revealed" : ""}`}
        onClick={revealed ? undefined : onReveal}
        role={revealed ? undefined : "button"}
        tabIndex={revealed ? undefined : 0}
        onKeyDown={
          revealed
            ? undefined
            : (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onReveal();
                }
              }
        }
        aria-label={revealed ? undefined : revealInstruction}
      >
        <p className={`review-translation${revealed ? "" : " review-translation-hidden"}`}>
          {sentence.translation}
        </p>
        {!revealed ? <span className="review-translation-overlay">{revealInstruction}</span> : null}
      </div>
      <div className="review-stats">
        <span>Streak {sentence.reviewStreak}</span>
        <span>{sentence.reviewedAt ? `Last reviewed ${new Date(sentence.reviewedAt).toLocaleString()}` : "Never reviewed"}</span>
      </div>
    </section>
  );
}
