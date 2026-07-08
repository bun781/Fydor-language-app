import { describe, expect, it } from "vitest";
import {
  collectReviewableUnits,
  getBestSentenceExampleForItem,
  getCanonicalItemsForSentence,
  getExamplesForReviewableUnit,
  getReviewableUnitsForSentence,
  getSentencesForCanonicalItem,
  makeUnitKey,
  parseUnitKey
} from "@/lib/review/reviewableUnit";
import type { StudySentence } from "@/lib/imported-content/types";

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

const greeting = sentence({
  id: "s1",
  text: "안녕하세요, 저는 학생이에요.",
  translation: "Hello, I am a student.",
  words: [
    {
      surface: "학생",
      displayText: "학생",
      meaning: "student",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:학생"
    }
  ],
  grammar: [
    {
      surfaceText: "이에요",
      pattern: "N + 이에요",
      meaning: "to be (polite)",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:이에요"
    }
  ],
  chunks: [
    {
      surfaceText: "안녕하세요",
      meaning: "hello",
      explanation: null,
      canonicalKey: "ko:안녕하세요"
    }
  ]
});

const longer = sentence({
  id: "s2",
  text: "그 학생은 매일 도서관에서 열심히 공부해요.",
  translation: "That student studies hard at the library every day.",
  words: [
    {
      surface: "학생",
      displayText: "학생",
      meaning: "student",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:학생"
    },
    {
      surface: "도서관",
      displayText: "도서관",
      meaning: "library",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:도서관"
    }
  ]
});

describe("unit keys", () => {
  it("round-trips through make/parse, keeping colons inside canonical keys", () => {
    const key = makeUnitKey("word", "ko:학생");
    expect(key).toBe("word:ko:학생");
    expect(parseUnitKey(key)).toEqual({ type: "word", identity: "ko:학생" });
  });

  it("rejects malformed keys", () => {
    expect(parseUnitKey("nonsense")).toBeNull();
    expect(parseUnitKey("verb:ko:하다")).toBeNull();
    expect(parseUnitKey("word:")).toBeNull();
  });
});

describe("reviewable units for a sentence", () => {
  it("produces one sentence unit plus one unit per annotated item", () => {
    const units = getReviewableUnitsForSentence(greeting);

    expect(units.map((unit) => unit.type)).toEqual(["sentence", "word", "grammar", "chunk"]);
    expect(units[0].unitKey).toBe("sentence:s1");
    expect(units[1].canonicalKey).toBe("ko:학생");
    expect(units[1].examples[0].surfaceText).toBe("학생");
  });

  it("filters the sentence unit out of canonical items", () => {
    expect(getCanonicalItemsForSentence(greeting)).toHaveLength(3);
  });
});

describe("cross-sentence unit collection", () => {
  it("merges the same canonical item across sentences into one unit with all examples", () => {
    const units = collectReviewableUnits([greeting, longer]);
    const student = units.get("word:ko:학생");

    expect(student).toBeDefined();
    expect(student!.examples.map((example) => example.sentenceId)).toEqual(["s1", "s2"]);
    // 2 sentence units + 학생, 도서관, grammar, chunk
    expect(units.size).toBe(6);
  });

  it("returns examples for a unit key and empty array for unknown keys", () => {
    expect(getExamplesForReviewableUnit("word:ko:학생", [greeting, longer])).toHaveLength(2);
    expect(getExamplesForReviewableUnit("word:ko:없다", [greeting, longer])).toEqual([]);
  });
});

describe("best example selection", () => {
  it("prefers the sentence with fewer competing annotations", () => {
    const best = getBestSentenceExampleForItem("word", "ko:학생", [greeting, longer]);
    // longer has 2 annotations total, greeting has 3
    expect(best?.id).toBe("s2");
  });

  it("returns null when no sentence contains the item", () => {
    expect(getBestSentenceExampleForItem("chunk", "ko:없는것", [greeting, longer])).toBeNull();
  });

  it("finds sentences for grammar and chunk items too", () => {
    expect(getSentencesForCanonicalItem("grammar", "ko:이에요", [greeting, longer]).map((s) => s.id)).toEqual(["s1"]);
    expect(getSentencesForCanonicalItem("chunk", "ko:안녕하세요", [greeting, longer]).map((s) => s.id)).toEqual(["s1"]);
  });
});
