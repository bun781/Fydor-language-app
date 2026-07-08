import { describe, expect, it } from "vitest";
import {
  clampSentenceIndex,
  nextSentenceIndex,
  previousSentenceIndex,
  toggleRevealedSentence
} from "@/lib/reading/readerNavigation";

describe("lesson reader navigation", () => {
  it("clamps the sentence index inside the lesson", () => {
    expect(clampSentenceIndex(0, 5)).toBe(0);
    expect(clampSentenceIndex(4, 5)).toBe(4);
    expect(clampSentenceIndex(9, 5)).toBe(4);
    expect(clampSentenceIndex(-3, 5)).toBe(0);
  });

  it("returns 0 for empty lessons instead of a negative index", () => {
    expect(clampSentenceIndex(2, 0)).toBe(0);
    expect(nextSentenceIndex(0, 0)).toBe(0);
    expect(previousSentenceIndex(0, 0)).toBe(0);
  });

  it("steps forward and backward without leaving the lesson", () => {
    expect(nextSentenceIndex(0, 3)).toBe(1);
    expect(nextSentenceIndex(2, 3)).toBe(2);
    expect(previousSentenceIndex(2, 3)).toBe(1);
    expect(previousSentenceIndex(0, 3)).toBe(0);
  });

  it("toggles per-sentence translation reveal without mutating the input set", () => {
    const initial = new Set<string>();
    const revealed = toggleRevealedSentence(initial, "s1");
    expect(revealed.has("s1")).toBe(true);
    expect(initial.size).toBe(0);

    const hidden = toggleRevealedSentence(revealed, "s1");
    expect(hidden.has("s1")).toBe(false);
    expect(revealed.has("s1")).toBe(true);
  });
});
