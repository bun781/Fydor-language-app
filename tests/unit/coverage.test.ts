import { describe, expect, it } from "vitest";
import {
  analyzeSentenceCoverage,
  getCanonicalKeysForSentence,
  sortSentencesForComprehensibleInput,
  summarizeLessonCoverage
} from "@/lib/imported-content/coverage";
import type { StudySentence } from "@/lib/imported-content/types";

const review = sentence({
  id: "review",
  text: "저는 학생입니다.",
  words: [
    word("저", "ko:저"),
    word("학생", "ko:학생")
  ],
  grammar: [grammar("입니다", "ko:입니다")]
});

const iPlusOne = sentence({
  id: "i-plus-one",
  text: "저는 선생님입니다.",
  words: [
    word("저", "ko:저"),
    word("선생님", "ko:선생님")
  ],
  grammar: [grammar("입니다", "ko:입니다")]
});

const tooHard = sentence({
  id: "too-hard",
  text: "오늘 도서관에서 공부합니다.",
  words: [
    word("오늘", "ko:오늘"),
    word("도서관", "ko:도서관"),
    word("공부", "ko:공부")
  ],
  grammar: [grammar("합니다", "ko:합니다")]
});

describe("sentence coverage analytics", () => {
  it("deduplicates canonical keys within a sentence", () => {
    const duplicate = sentence({
      id: "dupe",
      text: "저는 저를 봐요.",
      words: [
        word("저", "ko:저"),
        word("저를", "ko:저")
      ]
    });

    expect(getCanonicalKeysForSentence(duplicate)).toEqual(["ko:저"]);
  });

  it("classifies i+1 sentences from known canonical keys", () => {
    const coverage = analyzeSentenceCoverage(iPlusOne, ["ko:저", "ko:입니다"]);

    expect(coverage).toEqual({
      sentenceId: "i-plus-one",
      totalItems: 3,
      knownItems: 2,
      unknownItems: ["ko:선생님"],
      coveragePercent: 67,
      isIPlusOne: true
    });
  });

  it("summarizes lesson-level known and unknown canonical items", () => {
    const summary = summarizeLessonCoverage(
      [review, iPlusOne, tooHard],
      ["ko:저", "ko:학생", "ko:입니다"]
    );

    expect(summary).toEqual({
      sentenceCount: 3,
      totalCanonicalItems: 8,
      knownCanonicalItems: 3,
      unknownCanonicalItems: 5,
      coveragePercent: 38,
      iPlusOneSentenceIds: ["i-plus-one"]
    });
  });

  it("sorts reviewable and i+1 sentences ahead of too-hard sentences", () => {
    const sorted = sortSentencesForComprehensibleInput(
      [tooHard, iPlusOne, review],
      ["ko:저", "ko:학생", "ko:입니다"]
    );

    expect(sorted.map((sentence) => sentence.id)).toEqual(["review", "i-plus-one", "too-hard"]);
  });
});

function sentence(overrides: Partial<StudySentence> & { id: string; text: string }): StudySentence {
  return {
    translation: "",
    audioUrl: null,
    words: [],
    grammar: [],
    chunks: [],
    ...overrides
  };
}

function word(surface: string, canonicalKey: string) {
  return {
    surface,
    displayText: surface,
    meaning: null,
    explanation: null,
    commonMistakes: [],
    canonicalKey
  };
}

function grammar(surfaceText: string, canonicalKey: string) {
  return {
    surfaceText,
    pattern: surfaceText,
    meaning: null,
    explanation: null,
    commonMistakes: [],
    canonicalKey
  };
}
