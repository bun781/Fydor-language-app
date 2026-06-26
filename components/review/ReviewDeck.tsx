"use client";

import { useEffect, useState } from "react";
import { getReviewShortcutAction } from "@/lib/review/queue";
import type { ReviewSentence } from "@/lib/review/types";
import { useReviewDeck } from "@/lib/review/useReviewDeck";
import { ReviewControls } from "./ReviewControls";
import { ReviewSentenceCard } from "./ReviewSentenceCard";

interface ReviewDeckProps {
  sentences: ReviewSentence[];
}

export function ReviewDeck({ sentences }: ReviewDeckProps) {
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
    shuffleEnabled,
    toggleShuffle
  } = useReviewDeck(sentences);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [currentSentence?.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isInteractiveTarget(event.target)) return;
      if (!started) return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      const decision = getReviewShortcutAction(event.key);
      if (decision && revealed) {
        event.preventDefault();
        void reviewCurrent(decision);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [revealed, reviewCurrent, started]);

  if (!sentences.length) {
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
          <header className="review-header">
            <div>
              <h1>Review</h1>
              <p className="muted">Build a mixed queue from due, new, and older mastered sentences.</p>
            </div>
            <div className="review-summary">
              <span className="pill">Total {summary.total}</span>
              <span className="pill">Unknown {summary.unknown}</span>
              <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
              <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
            </div>
          </header>
          <section className="review-start-panel">
            <button className="button" type="button" onClick={() => startReview("mixed")}>
              Start Mixed Review
            </button>
            <div className="review-filter-row" aria-label="Review filters">
              <button className="button secondary" type="button" onClick={() => startReview("due")}>Due only</button>
              <button className="button secondary" type="button" onClick={() => startReview("new")}>New only</button>
              <button className="button secondary" type="button" onClick={() => startReview("all")}>All lessons</button>
            </div>
          </section>
          <LearningSciencePanel />
        </div>
      );
    }

    return (
      <section className="card review-empty">
        <h2>Review queue complete</h2>
        <p className="muted">This review pass is complete. Start another mixed review whenever you are ready.</p>
        <ReviewControls
          disabled={saving}
          shuffleEnabled={shuffleEnabled}
          shuffleDisabled
          visible={false}
          onForgot={() => reviewCurrent("forgot")}
          onHard={() => reviewCurrent("hard")}
          onRemembered={() => reviewCurrent("remembered")}
          onEasy={() => reviewCurrent("easy")}
          onToggleShuffle={toggleShuffle}
        />
      </section>
    );
  }

  return (
    <div className="review-shell">
      <header className="review-header">
        <div>
          <h1>Review</h1>
          <p className="muted">Recall before reveal. Space reveals; grade only after the answer is visible.</p>
        </div>
        <div className="review-summary">
          <span className="pill">Total {summary.total}</span>
          <span className="pill">Unknown {summary.unknown}</span>
          <span className="pill review-state-forgotten">Forgotten {summary.forgotten}</span>
          <span className="pill review-state-remembered">Remembered {summary.remembered}</span>
        </div>
      </header>

      {error ? <p className="review-error">{error}</p> : null}

      <ReviewSentenceCard
        sentence={currentSentence}
        index={position}
        total={queueTotal}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      <ReviewControls
        disabled={saving}
        shuffleEnabled={shuffleEnabled}
        shuffleDisabled
        visible={revealed}
        onForgot={() => reviewCurrent("forgot")}
        onHard={() => reviewCurrent("hard")}
        onRemembered={() => reviewCurrent("remembered")}
        onEasy={() => reviewCurrent("easy")}
        onToggleShuffle={toggleShuffle}
      />
      <LearningSciencePanel compact />
    </div>
  );
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function LearningSciencePanel({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`learning-science${compact ? " learning-science-compact" : ""}`}>
      <div>
        <h2>Learning Science</h2>
        <p className="muted">Methods used in this review session.</p>
      </div>
      <div className="learning-science-grid">
        <p><strong>Spaced Repetition</strong> — difficult sentences return sooner; mastered sentences appear less often.</p>
        <p><strong>Retrieval Practice</strong> — recall the sentence before revealing the answer.</p>
        <p><strong>Interleaving</strong> — review mixes sentences from different lessons.</p>
        <p><strong>Generation Effect</strong> — fill blanks or produce translations yourself.</p>
        <p><strong>Desirable Difficulties</strong> — hints are gradually removed as memory improves.</p>
      </div>
      <details className="learning-science-more">
        <summary>Learn more</summary>
        <p className="muted">Fydor combines due cards, new cards, and occasional older cards, then adjusts timing and hints from your self-grade.</p>
      </details>
    </section>
  );
}
