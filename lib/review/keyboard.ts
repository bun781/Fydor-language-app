export function shouldIgnoreReviewHotkey(event: Pick<KeyboardEvent, "repeat" | "target">): boolean {
  return event.repeat || isInteractiveTarget(event.target);
}

export function isSpaceKey(key: string): boolean {
  return key === " " || key === "Spacebar";
}

export function shouldRevealOnSpaceRelease(pressedSentenceId: string | null, currentSentenceId: string | null): boolean {
  return pressedSentenceId !== null && pressedSentenceId === currentSentenceId;
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;

  const element = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };

  if (element.isContentEditable) return true;
  return ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(element.tagName ?? "");
}
