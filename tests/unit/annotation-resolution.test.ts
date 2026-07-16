import { describe, expect, it } from "vitest";
import {
  annotationResolutionCacheKey,
  resolveAnnotation,
  withResolvedAnnotationMetadata
} from "@/lib/imported-content/annotation-resolution";
import { resolveLessonAnnotations } from "@/lib/imported-content/annotation-resolution";
import type { StudyLesson, StudyWord } from "@/lib/imported-content/types";

const local: StudyWord = {
  surface: "말", displayText: "말", meaning: "speech", explanation: "Local context", commonMistakes: [], canonicalKey: "ko:말"
};
const shared: StudyWord = {
  surface: "말", displayText: "말", meaning: "words", explanation: "Shared explanation", commonMistakes: [], canonicalKey: "ko:말"
};

describe("annotation resolution", () => {
  it("keeps an exact local annotation authoritative", () => {
    const result = resolveAnnotation(local, local, "word", "ko", "en", [{ annotation: shared, language: "ko", baseLanguage: "en", sourceLessonId: "other" }]);
    expect(result).toMatchObject({ annotation: local, origin: "local", matchReason: "local" });
  });

  it("uses only an exact directional language-pair fallback", () => {
    const result = resolveAnnotation(local, undefined, "word", "ko", "en", [
      { annotation: shared, language: "en", baseLanguage: "ko", sourceLessonId: "reverse" },
      { annotation: shared, language: "ko", baseLanguage: "vi", sourceLessonId: "vietnamese" },
      { annotation: shared, language: "ko", baseLanguage: "en", sourceLessonId: "eligible", sourceLessonTitle: "Shared Korean" }
    ]);
    expect(result).toMatchObject({ origin: "shared", sourceLessonId: "eligible", matchReason: "canonical" });
  });

  it("ranks canonical identity over a surface-only candidate", () => {
    const result = resolveAnnotation(local, undefined, "word", "ko", "en", [
      { annotation: { ...shared, canonicalKey: "ko:other" }, language: "ko", baseLanguage: "en", sourceLessonId: "surface" },
      { annotation: shared, language: "ko", baseLanguage: "en", sourceLessonId: "canonical" }
    ]);
    expect(result?.sourceLessonId).toBe("canonical");
  });

  it("rejects ambiguous equally strong fallback explanations", () => {
    const result = resolveAnnotation(local, undefined, "word", "ko", "en", [
      { annotation: shared, language: "ko", baseLanguage: "en", sourceLessonId: "a" },
      { annotation: { ...shared, meaning: "horse" }, language: "ko", baseLanguage: "en", sourceLessonId: "b" }
    ]);
    expect(result).toBeUndefined();
  });

  it("marks copied metadata independently without changing the source", () => {
    const resolved = resolveAnnotation(local, undefined, "word", "ko", "en", [{ annotation: shared, language: "ko", baseLanguage: "en", sourceLessonId: "source" }]);
    expect(resolved).toBeDefined();
    const copied = withResolvedAnnotationMetadata({ ...resolved!.annotation, meaning: "My local edit" }, { ...resolved!, origin: "local", matchReason: "local" });
    expect(copied.meaning).toBe("My local edit");
    expect(shared.meaning).toBe("words");
  });

  it("isolates cache keys by direction", () => {
    const base = { lessonId: "l", sentenceId: "s", canonicalKey: "ko:말", kind: "word" as const, version: 1 };
    expect(annotationResolutionCacheKey({ ...base, language: "ko", baseLanguage: "en" }))
      .not.toBe(annotationResolutionCacheKey({ ...base, language: "en", baseLanguage: "ko" }));
  });

  it("adds an uncovered shared highlight only from the same directional pair", () => {
    const target = fixture("target", "ko", "en", "말을 해요", []);
    const eligible = fixture("eligible", "ko", "en", "말", [shared]);
    const reversed = fixture("reversed", "en", "ko", "말", [{ ...shared, meaning: "reverse" }]);
    const resolved = resolveLessonAnnotations(target, [target, eligible, reversed]);
    expect(resolved.sentences[0].words).toHaveLength(1);
    expect(resolved.sentences[0].words[0]).toMatchObject({ meaning: "words", annotationOrigin: "shared", sourceLessonId: "eligible" });
  });
});

function fixture(id: string, language: string, baseLanguage: string, text: string, words: StudyWord[]): StudyLesson {
  return {
    id, language, baseLanguage, title: id, description: null, source: null, level: null, tags: [],
    sentences: [{ id: `${id}-s`, text, translation: "", audioUrl: null, words, grammar: [], chunks: [] }]
  };
}
