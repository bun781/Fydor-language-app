import { describe, expect, it } from "vitest";
import { buildChoices, buildFillBlankDeck } from "@/components/imported-content/FillBlankMode";

describe("fill blank choices", () => {
  it("always keeps the correct answer in the visible choices", () => {
    const deck = makeDeck([
      "right answer",
      "distractor one",
      "distractor two",
      "distractor three",
      "distractor four",
      "distractor five"
    ]);

    const choices = buildChoices("right answer", deck);

    expect(choices).toContain("right answer");
    expect(choices.length).toBeLessThanOrEqual(4);
  });

  it("builds at most one card for each sentence", () => {
    const lesson = {
      id: "lesson-1",
      language: "ko",
      baseLanguage: "en",
      title: "Basics",
      description: null,
      source: null,
      level: null,
      tags: [],
      sentences: [
        {
          id: "s1",
          text: "저는 학생입니다.",
          translation: "I am a student.",
          audioUrl: null,
          words: [
            { surface: "저", displayText: "저", meaning: "I", explanation: null, commonMistakes: [], canonicalKey: "ko:i" },
            { surface: "학생", displayText: "학생", meaning: "student", explanation: null, commonMistakes: [], canonicalKey: "ko:student" }
          ],
          grammar: [
            { surfaceText: "입니다", pattern: "입니다", meaning: "to be", explanation: null, commonMistakes: [], canonicalKey: "ko:be" }
          ],
          chunks: []
        }
      ]
    };

    const deck = buildFillBlankDeck(lesson);

    expect(deck).toHaveLength(1);
    expect(new Set(deck.map((card) => card.sentence.id)).size).toBe(deck.length);
  });
});

function makeDeck(answerTexts: string[]) {
  return answerTexts.map((answerText, index) => ({
    id: `card-${index}`,
    sentence: {
      id: `sentence-${index}`,
      text: `Sentence ${index}`,
      translation: "",
      audioUrl: null,
      words: [],
      grammar: [],
      chunks: []
    },
    candidate: {
      id: `candidate-${index}`,
      start: 0,
      end: 1,
      kind: "word" as const,
      displayText: answerText,
      answerText,
      meaning: null,
      explanation: null
    },
    lessonId: "lesson-1",
    lessonTitle: "Basics"
  }));
}
