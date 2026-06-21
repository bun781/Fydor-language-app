import { describe, expect, it } from "vitest";
import { buildAnnotatedSentenceRuns } from "@/components/imported-content/AnnotatedSentence";
import type { StudySentence } from "@/lib/imported-content/types";

describe("annotated sentence runs", () => {
  it("keeps overlapping word and grammar annotations on the same text", () => {
    const runs = buildAnnotatedSentenceRuns(buildSentence({
      text: "책을 읽고 있어요.",
      words: [{ surface: "읽고", displayText: "읽다", meaning: "to read", explanation: null, commonMistakes: [], canonicalKey: "ko:읽다" }],
      grammar: [{ surfaceText: "읽고 있어요", pattern: "-고 있다", meaning: "progressive action", explanation: null, commonMistakes: [], canonicalKey: "ko:-고 있다" }]
    }));

    expect(runs).toEqual([
      { kind: "plain", text: "책을 " },
      expect.objectContaining({
        kind: "annotated",
        text: "읽고",
        annotations: [
          expect.objectContaining({ kind: "word", displayText: "읽다" }),
          expect.objectContaining({ kind: "grammar", displayText: "-고 있다" })
        ]
      }),
      expect.objectContaining({
        kind: "annotated",
        text: " 있어요",
        annotations: [
          expect.objectContaining({ kind: "grammar", displayText: "-고 있다" })
        ]
      }),
      { kind: "plain", text: "." }
    ]);
  });
});

function buildSentence(overrides: Partial<StudySentence>): StudySentence {
  return {
    id: "sentence-1",
    text: "",
    translation: "",
    audioUrl: null,
    words: [],
    grammar: [],
    chunks: [],
    ...overrides
  };
}
