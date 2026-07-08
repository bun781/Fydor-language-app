// TS side of the Rust<->TS review contract. The same fixture is asserted from
// src-tauri/src/review.rs, so a change to either implementation fails one side's suite.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { progressRecallMode } from "@/lib/review/recallModes";
import { applyReviewDecision } from "@/lib/review/scheduler";
import type { RecallMode, ReviewDecision, ReviewGrade, ReviewSentence } from "@/lib/review/types";

interface GradeCase {
  decision: ReviewDecision;
  normalized: ReviewGrade;
  legacyState: ReviewSentence["reviewState"];
}

interface RecallCase {
  mode: RecallMode;
  grade: ReviewGrade;
  next: RecallMode;
}

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../fixtures/review-grade-contract.json"), "utf8")
) as { grades: GradeCase[]; recallModeProgression: RecallCase[] };

function sentence(recallMode: RecallMode = "full_support"): ReviewSentence {
  return {
    id: "s1",
    language: "ko",
    text: "안녕하세요.",
    translation: "Hello.",
    reviewState: "unknown",
    reviewStreak: 0,
    reviewedAt: null,
    recallMode
  };
}

describe("review grade contract (mirrors review.rs)", () => {
  it("covers every grade and every recall mode transition", () => {
    expect(fixture.grades).toHaveLength(5);
    expect(fixture.recallModeProgression).toHaveLength(20);
  });

  it.each(fixture.grades)("maps decision %j to the legacy review state", ({ decision, legacyState }) => {
    expect(applyReviewDecision(sentence(), decision).reviewState).toBe(legacyState);
  });

  it.each(fixture.recallModeProgression)(
    "progresses recall mode %j",
    ({ mode, grade, next }) => {
      expect(progressRecallMode(mode, grade)).toBe(next);
      expect(applyReviewDecision(sentence(mode), grade).recallMode).toBe(next);
    }
  );
});
