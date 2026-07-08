// Pure navigation helpers for the lesson reader. Kept out of the component so
// keyboard behavior is unit-testable in the node Vitest environment.

export function clampSentenceIndex(index: number, sentenceCount: number): number {
  if (sentenceCount <= 0) return 0;
  return Math.min(Math.max(index, 0), sentenceCount - 1);
}

export function nextSentenceIndex(current: number, sentenceCount: number): number {
  return clampSentenceIndex(current + 1, sentenceCount);
}

export function previousSentenceIndex(current: number, sentenceCount: number): number {
  return clampSentenceIndex(current - 1, sentenceCount);
}

export function toggleRevealedSentence(revealed: ReadonlySet<string>, sentenceId: string): Set<string> {
  const next = new Set(revealed);
  if (next.has(sentenceId)) next.delete(sentenceId);
  else next.add(sentenceId);
  return next;
}
