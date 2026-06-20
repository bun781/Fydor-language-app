import { describe, expect, it } from "vitest";
import { generateSentenceForgeDrills } from "@/lib/language/generateDrills";
import { parseLessonJson } from "@/lib/language/importSchema";
import { normalizeSentenceText } from "@/lib/language/normalize";
import { scheduleSentenceReview } from "@/lib/language/srs";

const validLesson = {
  targetLanguage: "ja",
  baseLanguage: "en",
  title: "Basic wants",
  sentences: [
    {
      text: "寿司を食べたい。",
      translation: "I want to eat sushi.",
      focus: {
        type: "grammar",
        canonicalKey: "ja:grammar:tai_want_to",
        displayText: "〜たい"
      },
      tokens: [
        { text: "寿司", type: "word", canonicalKey: "ja:word:寿司:noun", meaning: "sushi" },
        { text: "を", type: "grammar", canonicalKey: "ja:grammar:object_marker_wo", meaning: "object marker" }
      ],
      drills: {
        recallPrompt: "How do you say: I want to eat sushi?",
        clozePrompt: "寿司を____。",
        clozeAnswer: "食べたい"
      }
    }
  ]
};

describe("lesson import validation", () => {
  it("rejects invalid json", () => {
    expect(parseLessonJson("{").errors).toContain("Invalid JSON.");
  });

  it("warns about missing tokens without rejecting the lesson", () => {
    const result = parseLessonJson(JSON.stringify({
      targetLanguage: "ja",
      baseLanguage: "en",
      title: "No tokens",
      sentences: [{ text: "はい。", translation: "Yes." }]
    }));

    expect(result.lesson?.title).toBe("No tokens");
    expect(result.warnings.map((warning) => warning.code)).toContain("missing_tokens");
    expect(result.warnings.map((warning) => warning.code)).toContain("missing_drills");
  });
});

describe("sentence forge generation", () => {
  it("creates the required five drills for a sentence", () => {
    const result = parseLessonJson(JSON.stringify(validLesson));
    const drills = generateSentenceForgeDrills(result.lesson!.sentences[0]);

    expect(drills.map((drill) => drill.type)).toEqual([
      "recall",
      "reconstruction",
      "cloze",
      "transformation",
      "original_sentence"
    ]);
    expect(drills[2].answer).toBe("食べたい");
  });
});

describe("language normalization and srs", () => {
  it("normalizes sentence text for duplicate detection", () => {
    expect(normalizeSentenceText("  I   WANT  sushi  ")).toBe("i want sushi");
  });

  it("uses fixed sentence review intervals", () => {
    const reviewedAt = new Date("2026-06-20T00:00:00.000Z");

    expect(scheduleSentenceReview("failed", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-21T00:00:00.000Z");
    expect(scheduleSentenceReview("hard", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-23T00:00:00.000Z");
    expect(scheduleSentenceReview("correct", reviewedAt).nextReviewAt.toISOString()).toBe("2026-06-27T00:00:00.000Z");
    expect(scheduleSentenceReview("easy", reviewedAt).nextReviewAt.toISOString()).toBe("2026-07-04T00:00:00.000Z");
  });
});
