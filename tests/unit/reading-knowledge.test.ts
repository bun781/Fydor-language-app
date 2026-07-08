import { describe, expect, it } from "vitest";
import {
  analyzeReadingText,
  deriveReadingKnowledge,
  lexiconInputsToEntries,
  type ReadingItemStateInput,
  type ReadingLexiconInput
} from "@/lib/reading/analyzer";

function itemState(canonicalKey: string, repetitions: number, itemType: ReadingItemStateInput["itemType"] = "word"): ReadingItemStateInput {
  return { canonicalKey, repetitions, itemType };
}

describe("deriveReadingKnowledge", () => {
  it("treats items with successful repetitions as known", () => {
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      [itemState("ko:학생", 2), itemState("ko:이에요", 1, "grammar")],
      []
    );

    expect(knownCanonicalKeys).toEqual(new Set(["ko:학생", "ko:이에요"]));
    expect(learningCanonicalKeys.size).toBe(0);
  });

  it("treats graded-but-never-recalled items as learning", () => {
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      [itemState("ko:학생", 0)],
      []
    );

    expect(knownCanonicalKeys.size).toBe(0);
    expect(learningCanonicalKeys).toEqual(new Set(["ko:학생"]));
  });

  it("falls back to remembered-sentence inference for keys without item rows", () => {
    const { knownCanonicalKeys } = deriveReadingKnowledge([], ["ko:학생", "ko:이에요"]);
    expect(knownCanonicalKeys).toEqual(new Set(["ko:학생", "ko:이에요"]));
  });

  it("lets item review state override sentence inference per key", () => {
    // 학생 was in a remembered sentence, but its item row shows it has never been
    // recalled on its own — the item state wins.
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      [itemState("ko:학생", 0), itemState("ko:왔어요", 3)],
      ["ko:학생", "ko:이에요"]
    );

    expect(knownCanonicalKeys).toEqual(new Set(["ko:왔어요", "ko:이에요"]));
    expect(learningCanonicalKeys).toEqual(new Set(["ko:학생"]));
  });

  it("prefers a recalled row when the same key has rows of both kinds", () => {
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      [itemState("ko:같다", 0, "word"), itemState("ko:같다", 2, "chunk")],
      []
    );

    expect(knownCanonicalKeys).toEqual(new Set(["ko:같다"]));
    expect(learningCanonicalKeys.size).toBe(0);
  });
});

describe("reading analysis from minimal Rust inputs", () => {
  const lexicon: ReadingLexiconInput[] = [
    { itemType: "word", canonicalKey: "ko:학생", displayText: "학생", meaning: "student", surfaces: ["학생"] },
    { itemType: "grammar", canonicalKey: "ko:이에요", displayText: "N + 이에요", meaning: "to be", surfaces: ["N + 이에요", "이에요"] },
    { itemType: "word", canonicalKey: "ko:왔어요", displayText: "왔어요", meaning: null, surfaces: ["왔어요"] }
  ];

  it("maps lexicon inputs to analyzer entries without example sentences", () => {
    const entries = lexiconInputsToEntries(lexicon);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ type: "word", canonicalKey: "ko:학생", displayText: "학생", meaning: "student" });
    expect(entries[0].exampleSentenceIds).toEqual([]);
  });

  it("drives token status from item-state knowledge end to end", () => {
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      [itemState("ko:학생", 2), itemState("ko:왔어요", 0)],
      []
    );

    const analysis = analyzeReadingText(
      "학생 왔어요",
      lexiconInputsToEntries(lexicon),
      knownCanonicalKeys,
      { locale: "ko", learningCanonicalKeys }
    );

    const matches = analysis.tokens.filter((token) => token.match);
    expect(matches).toHaveLength(2);
    expect(matches[0].match).toMatchObject({ canonicalKey: "ko:학생", status: "known" });
    expect(matches[1].match).toMatchObject({ canonicalKey: "ko:왔어요", status: "learning" });
    expect(analysis.coverage.knownWordLikeTokens).toBe(1);
    expect(analysis.coverage.learningWordLikeTokens).toBe(1);
  });
});
