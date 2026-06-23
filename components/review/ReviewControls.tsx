"use client";

import { Shuffle } from "lucide-react";

interface ReviewControlsProps {
  disabled?: boolean;
  shuffleEnabled: boolean;
  shuffleDisabled?: boolean;
  onRemembered: () => void;
  onForgotten: () => void;
  onToggleShuffle: () => void;
}

export function ReviewControls({
  disabled,
  shuffleEnabled,
  shuffleDisabled,
  onRemembered,
  onForgotten,
  onToggleShuffle
}: ReviewControlsProps) {
  const shufflePressedLabel = shuffleEnabled ? "Random order on" : "Random order off";
  const shuffleLockedLabel = "Random order locked on";

  return (
    <div className="review-controls">
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
          disabled={disabled}
          onClick={onForgotten}
          title="Not remembered  ·  ←"
        >
          ← Not Remembered
        </button>
        <button
          className="button review-positive"
          type="button"
          disabled={disabled}
          onClick={onRemembered}
          title="Remembered  ·  →"
        >
          Remembered →
        </button>
      </div>

      <p className="review-hotkey-hint" aria-label="Keyboard shortcut hint">
        Random order is always on. Use <kbd>←</kbd> for Not Remembered and <kbd>→</kbd> for Remembered.
      </p>
    </div>
  );
}
