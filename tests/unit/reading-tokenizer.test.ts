import { describe, expect, it } from "vitest";
import { analyzeReadingText, buildReadingLexicon } from "@/lib/reading/analyzer";
import { tokenizeForReading } from "@/lib/reading/tokenizer";
import type { StudySentence } from "@/lib/imported-content/types";

describe("reading tokenizer", () => {
  it("keeps repeated words as separate token occurrences", () => {
    const tokens = tokenizeForReading("hello hello", "en").filter((token) => token.isWordLike);

    expect(tokens.map((token) => token.text)).toEqual(["hello", "hello"]);
    expect(tokens.map((token) => token.start)).toEqual([0, 6]);
  });

  it("separates punctuation from word-like tokens", () => {
    const tokens = tokenizeForReading("Bonjour, monde!", "fr");

    expect(tokens.map((token) => [token.text, token.kind])).toEqual([
      ["Bonjour", "word"],
      [",", "punctuation"],
      [" ", "space"],
      ["monde", "word"],
      ["!", "punctuation"]
    ]);
  });

  it("handles CJK text without dropping offsets", () => {
    const tokens = tokenizeForReading("我喜欢中文。", "zh");

    expect(tokens.map((token) => token.text).join("")).toBe("我喜欢中文。");
    expect(tokens.at(-1)).toEqual(expect.objectContaining({ text: "。", kind: "punctuation" }));
  });

  it("handles mixed-language text and numbers", () => {
    const tokens = tokenizeForReading("오늘 lesson 2입니다.", "ko");
    const wordLike = tokens.filter((token) => token.isWordLike);

    expect(wordLike.map((token) => token.normalized)).toEqual(["오늘", "lesson", "2", "입니다"]);
  });

  it("returns no tokens for empty text", () => {
    expect(tokenizeForReading("")).toEqual([]);
  });
});

describe("reading text analysis", () => {
  it("matches real lesson annotations to known and learning tokens", () => {
    const lexicon = buildReadingLexicon([
      sentence({
        id: "s1",
        text: "저는 학생입니다.",
        words: [word("저", "ko:저"), word("학생", "ko:학생")]
      })
    ]);

    const analysis = analyzeReadingText("저 학생 선생님", lexicon, ["ko:저"], { locale: "ko" });

    expect(analysis.tokens.filter((token) => token.match).map((token) => token.match?.canonicalKey)).toEqual([
      "ko:저",
      "ko:학생"
    ]);
    expect(analysis.coverage).toEqual(expect.objectContaining({
      totalWordLikeTokens: 3,
      matchedWordLikeTokens: 2,
      knownWordLikeTokens: 1,
      learningWordLikeTokens: 1,
      unknownWordLikeTokens: 1,
      knownPercent: 33,
      isIPlusOne: false,
      likelyDifficulty: "unsupported"
    }));
    expect(analysis.coverage.unknownTokens).toEqual(["선생님"]);
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
