import { describe, expect, it } from "vitest";
import {
  generateClozeExercise,
  generateExercisesForSentence,
  generateReorderExercise,
  generateTypedRecallExercise
} from "@/lib/imported-content/exercise-generators";
import type { StudySentence } from "@/lib/imported-content/types";

const sentence: StudySentence = {
  id: "s1",
  text: "저는 학생입니다.",
  translation: "I am a student.",
  audioUrl: null,
  words: [
    {
      surface: "저",
      displayText: "저",
      meaning: "I",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:저"
    },
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
      surfaceText: "입니다",
      pattern: "입니다",
      meaning: "to be",
      explanation: null,
      commonMistakes: [],
      canonicalKey: "ko:입니다"
    }
  ],
  chunks: []
};

describe("exercise generators", () => {
  it("generates a cloze exercise from annotated material", () => {
    const exercise = generateClozeExercise(sentence, "attempt-1");

    expect(exercise).toEqual(expect.objectContaining({
      kind: "cloze",
      sentenceId: "s1",
      translation: "I am a student."
    }));
    expect(exercise).not.toBeNull();
    expect(exercise!.before + exercise!.answer + exercise!.after).toBe(sentence.text);
    expect(["word", "grammar"]).toContain(exercise?.focusKind);
  });

  it("generates deterministic reorder exercises with the same answer tokens", () => {
    const first = generateReorderExercise(sentence, { seed: "same", locale: "ko" });
    const second = generateReorderExercise(sentence, { seed: "same", locale: "ko" });

    expect(first).toEqual(second);
    expect(first?.answerTokens.join("")).toBe("저는학생입니다");
    expect(first?.scrambledTokens).toHaveLength(first?.answerTokens.length ?? 0);
    expect(first?.scrambledTokens).not.toEqual(first?.answerTokens);
  });

  it("generates typed recall from translation to sentence text", () => {
    expect(generateTypedRecallExercise(sentence)).toEqual(expect.objectContaining({
      kind: "typed-recall",
      prompt: "I am a student.",
      answer: "저는 학생입니다."
    }));
  });

  it("returns only requested exercise kinds", () => {
    const exercises = generateExercisesForSentence(sentence, {
      include: ["reorder", "typed-recall"],
      seed: "subset",
      locale: "ko"
    });

    expect(exercises.map((exercise) => exercise.kind)).toEqual(["reorder", "typed-recall"]);
  });

  it("skips exercises when the sentence lacks required source material", () => {
    const empty: StudySentence = {
      id: "empty",
      text: "",
      translation: "",
      audioUrl: null,
      words: [],
      grammar: [],
      chunks: []
    };

    expect(generateExercisesForSentence(empty)).toEqual([]);
  });
});
