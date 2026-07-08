import type { ReviewGrade } from "./types";

export function getReviewShortcutAction(key: string): ReviewGrade | null {
  if (key === "ArrowLeft" || key === "1") return "forgot";
  if (key === "2") return "hard";
  if (key === "ArrowRight" || key === "3") return "remembered";
  if (key === "4") return "easy";
  return null;
}

export function shouldIgnoreReviewHotkey(event: Pick<KeyboardEvent, "repeat" | "target">): boolean {
  return event.repeat || isInteractiveTarget(event.target);
}

export function isSpaceKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

export function shouldRevealOnSpaceRelease(pressedSentenceId: string | null, currentSentenceId: string | null): boolean {
  return pressedSentenceId !== null && pressedSentenceId === currentSentenceId;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;

  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };

  if (element.isContentEditable) return true;
  return ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(element.tagName ?? "");
}
