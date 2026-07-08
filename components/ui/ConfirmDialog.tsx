import type { ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

// Single confirm-dialog implementation for every destructive/confirm flow in the app
// (quiz exit, lesson delete, draft replace, review resets).
export function ConfirmDialog({
  idPrefix,
  title,
  description,
  descriptionMuted = true,
  cancelLabel,
  confirmLabel,
  confirmDanger = false,
  busy = false,
  actionsClassName = "row",
  dialogClassName = "",
  onCancel,
  onConfirm
}: {
  idPrefix: string;
  title: string;
  description: ReactNode;
  descriptionMuted?: boolean;
  cancelLabel: string;
  confirmLabel: ReactNode;
  confirmDanger?: boolean;
  /** Disables both buttons and backdrop-click dismissal while the action runs. */
  busy?: boolean;
  actionsClassName?: string;
  dialogClassName?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        className={`${styles.dialog} ${dialogClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-title`}
      >
        <h2 id={`${idPrefix}-title`}>{title}</h2>
        <p className={descriptionMuted ? "muted" : undefined}>{description}</p>
        <div className={actionsClassName}>
          <button className="button secondary" type="button" autoFocus disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={confirmDanger ? "button danger" : "button"}
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
