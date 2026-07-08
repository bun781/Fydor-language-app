interface ReviewControlsProps {
  disabled?: boolean;
  visible?: boolean;
  onForgot: () => void;
  onHard: () => void;
  onRemembered: () => void;
  onEasy: () => void;
}

export function ReviewControls({
  disabled,
  visible = true,
  onForgot,
  onHard,
  onRemembered,
  onEasy
}: ReviewControlsProps) {
  return (
    <div className="review-controls" data-tour="review-controls">
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
