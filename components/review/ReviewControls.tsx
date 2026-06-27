"use client";

import { Shuffle } from "lucide-react";

interface ReviewControlsProps {
  disabled?: boolean;
  shuffleEnabled: boolean;
  shuffleDisabled?: boolean;
  visible?: boolean;
  onForgot: () => void;
  onHard: () => void;
  onRemembered: () => void;
  onEasy: () => void;
  onToggleShuffle: () => void;
}

export function ReviewControls({
  disabled,
  shuffleEnabled,
  shuffleDisabled,
  visible = true,
  onForgot,
  onHard,
  onRemembered,
  onEasy,
  onToggleShuffle
}: ReviewControlsProps) {
  const shufflePressedLabel = shuffleEnabled ? "Random order on" : "Random order off";
  const shuffleLockedLabel = "Random order locked on";

  return (
    <div className="review-controls" data-tour="review-controls">
      <button
        type="button"
        className={`shuffle-toggle${shuffleEnabled ? " shuffle-toggle--on" : ""}`}
        onClick={onToggleShuffle}
        disabled={disabled || shuffleDisabled}
        aria-pressed={shuffleEnabled}
        aria-label={shuffleDisabled ? shuffleLockedLabel : shufflePressedLabel}
        title={shuffleDisabled ? shuffleLockedLabel : shufflePressedLabel}
      >
        <Shuffle size={14} className="shuffle-icon" />
        <span className="shuffle-track">
          <span className="shuffle-thumb" />
        </span>
        <span className="shuffle-label">Random order</span>
      </button>

      <div className="review-action-group">
        <button
          className="button review-negative"
          type="button"
          disabled={disabled || !visible}
          onClick={onForgot}
          title="Forgot  ·  ← or 1"
        >
          Forgot
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={disabled || !visible}
          onClick={onHard}
          title="Hard  ·  2"
        >
          Hard
        </button>
        <button
          className="button review-positive"
          type="button"
          disabled={disabled || !visible}
          onClick={onRemembered}
          title="Remembered  ·  → or 3"
        >
          Remembered
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={disabled || !visible}
          onClick={onEasy}
          title="Easy  ·  4"
        >
          Easy
        </button>
      </div>

      <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
        Grade after reveal. <kbd>←</kbd> Forgot, <kbd>→</kbd> Remembered, or <kbd>1</kbd>-<kbd>4</kbd>.
      </p>
    </div>
  );
}
