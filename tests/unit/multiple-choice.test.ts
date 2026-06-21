import { describe, expect, it } from "vitest";
import { buildQuizDeck } from "@/lib/imported-content/study-utils";
import type { StudySentence } from "@/lib/imported-content/types";

describe("multiple choice deck", () => {
  it("builds a deck of multiple choice questions from a lesson sentence pool", () => {
    const sentences = makeSentences();
    const deck = buildQuizDeck(sentences, sentences);

    expect(deck.length).toBeGreaterThan(0);
    expect(deck.every((question) => question.type === "multiple-choice")).toBe(true);
    expect(deck.some((question) => question.focusType === "word")).toBe(true);
    expect(deck.some((question) => question.focusType === "sentence")).toBe(true);
  });
});

function makeSentences(): StudySentence[] {
  return [
    {
      id: "s1",
      text: "안녕하세요.",
      translation: "Hello.",
      audioUrl: null,
      words: [{ surface: "안녕하세요", displayText: "안녕하세요", meaning: "Hello", explanation: null, commonMistakes: [], canonicalKey: "ko:hello" }],
      grammar: [],
      chunks: []
    },
    {
      id: "s2",
      text: "감사합니다.",
      translation: "Thank you.",
      audioUrl: null,
      words: [{ surface: "감사합니다", displayText: "감사합니다", meaning: "Thank you", explanation: null, commonMistakes: [], canonicalKey: "ko:thank-you" }],
      grammar: [],
      chunks: []
    },
    {
      id: "s3",
      text: "좋은 아침입니다.",
      translation: "Good morning.",
      audioUrl: null,
      words: [{ surface: "아침", displayText: "아침", meaning: "Morning", explanation: null, commonMistakes: [], canonicalKey: "ko:morning" }],
      grammar: [],
      chunks: []
    }
  ];
}
