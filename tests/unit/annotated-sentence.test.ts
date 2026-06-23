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

  it("annotates every repeated surface instead of only the first one", () => {
    const runs = buildAnnotatedSentenceRuns(buildSentence({
      text: "저는 저를 좋아합니다.",
      words: [{ surface: "저", displayText: "저", meaning: "I / me", explanation: null, commonMistakes: [], canonicalKey: "ko:저" }]
    }));

    const annotatedText = runs
      .filter((run) => run.kind === "annotated")
      .map((run) => run.text);

    expect(annotatedText).toEqual(["저", "저"]);
  });

  it("matches multi-word chunks across punctuation differences", () => {
    const runs = buildAnnotatedSentenceRuns(buildSentence({
      text: "Let's eat, now.",
      chunks: [{ surfaceText: "eat now", meaning: "start eating now", explanation: null, canonicalKey: "en:eat-now" }]
    }));

    expect(runs).toEqual([
      { kind: "plain", text: "Let's " },
      expect.objectContaining({
        kind: "annotated",
        text: "eat, now",
        annotations: [
          expect.objectContaining({ kind: "chunk", displayText: "eat now" })
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
