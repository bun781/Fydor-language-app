import type { StudyChunk, StudyGrammar, StudyLesson, StudySentence, StudyWord } from "./types";

export type AnnotationKind = "word" | "grammar" | "chunk";
export type AnnotationOrigin = "local" | "shared";
export type AnnotationMatchReason = "local" | "canonical" | "normalized-surface" | "lemma" | "alias";

export interface ResolvedAnnotation<T> {
  annotation: T;
  origin: AnnotationOrigin;
  sourceLessonId?: string;
  sourceLessonTitle?: string;
  matchReason: AnnotationMatchReason;
}

export interface AnnotationCandidate<T> {
  annotation: T;
  language: string;
  baseLanguage: string;
  sourceLessonId: string;
  sourceLessonTitle?: string;
  aliases?: string[];
}

/**
 * Resolves one annotation target without guessing. Local annotations always win.
 * Shared candidates must have the same directional pair and an exact canonical
 * key, normalized surface, lemma, or approved alias. This deliberately rejects
 * fuzzy/context-only candidates until a deterministic equivalence is recorded.
 */
export function resolveAnnotation<T extends TargetAnnotation>(
  target: T,
  local: T | undefined,
  kind: AnnotationKind,
  language: string,
  baseLanguage: string,
  candidates: AnnotationCandidate<T>[]
): ResolvedAnnotation<T> | undefined {
  if (local) return { annotation: local, origin: "local", matchReason: "local" };

  const targetKey = canonicalTarget(target, kind);
  const targetSurface = normalizedSurface(target, kind);
  const targetLemma = lemma(target, kind);
  if (!targetKey && !targetSurface && !targetLemma) return undefined;

  const eligible = candidates
    .filter((candidate) => candidate.language === language && candidate.baseLanguage === baseLanguage)
    .map((candidate) => ({ candidate, score: matchScore(candidate.annotation, kind, targetKey, targetSurface, targetLemma, candidate.aliases) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score || left.candidate.sourceLessonId.localeCompare(right.candidate.sourceLessonId));

  const best = eligible[0];
  if (!best || (eligible[1] && best.score === eligible[1].score && !sameAnnotation(best.candidate.annotation, eligible[1].candidate.annotation, kind))) return undefined;

  return {
    annotation: best.candidate.annotation,
    origin: "shared",
    sourceLessonId: best.candidate.sourceLessonId,
    sourceLessonTitle: best.candidate.sourceLessonTitle,
    matchReason: best.score === 4 ? "canonical" : best.score === 3 ? "normalized-surface" : best.score === 2 ? "lemma" : "alias"
  };
}

type TargetAnnotation = StudyWord | StudyGrammar | StudyChunk;

function canonicalTarget(annotation: TargetAnnotation | undefined, _kind: AnnotationKind) {
  return annotation?.canonicalKey?.trim().toLocaleLowerCase();
}

function normalizedSurface(annotation: TargetAnnotation | undefined, kind: AnnotationKind) {
  if (!annotation) return "";
  return normalize(surfaceOf(annotation, kind));
}

function lemma(annotation: TargetAnnotation | undefined, kind: AnnotationKind) {
  if (!annotation || kind !== "word") return "";
  return normalize("displayText" in annotation ? annotation.displayText : "");
}

function matchScore(annotation: TargetAnnotation, kind: AnnotationKind, key: string | undefined, surface: string, targetLemma: string, aliases: string[] | undefined) {
  if (key && canonicalTarget(annotation, kind) === key) return 4;
  if (surface && normalizedSurface(annotation, kind) === surface) return 3;
  if (targetLemma && lemma(annotation, kind) === targetLemma) return 2;
  if (aliases?.some((alias) => normalize(alias) === surface || normalize(alias) === targetLemma)) return 1;
  return 0;
}

function sameAnnotation(left: TargetAnnotation, right: TargetAnnotation, kind: AnnotationKind) {
  return canonicalTarget(left, kind) === canonicalTarget(right, kind)
    && normalizedSurface(left, kind) === normalizedSurface(right, kind)
    // Same target with competing explanations is not a safe automatic fallback.
    // A reviewer must explicitly choose or record an equivalence first.
    && meaningOf(left) === meaningOf(right)
    && explanationOf(left) === explanationOf(right);
}

function meaningOf(annotation: TargetAnnotation): string | null { return annotation.meaning; }
function explanationOf(annotation: TargetAnnotation): string | null { return annotation.explanation; }

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

/** A cache key must never cross a directional language boundary. */
export function annotationResolutionCacheKey(input: { language: string; baseLanguage: string; lessonId: string; sentenceId: string; canonicalKey: string; kind: AnnotationKind; version: string | number }) {
  return [input.language, input.baseLanguage, input.lessonId, input.sentenceId, input.kind, input.canonicalKey, input.version].join("\u001f");
}

export function annotationTargetText(annotation: StudyWord | StudyGrammar | StudyChunk, kind: AnnotationKind) {
  return surfaceOf(annotation, kind);
}

function surfaceOf(annotation: TargetAnnotation, kind: AnnotationKind): string {
  if (kind === "word" && "surface" in annotation) return annotation.surface;
  if (kind !== "word" && "surfaceText" in annotation) return annotation.surfaceText;
  return "";
}

export function withResolvedAnnotationMetadata<T extends StudyWord | StudyGrammar | StudyChunk>(annotation: T, resolved: ResolvedAnnotation<T>): T {
  return { ...annotation, annotationOrigin: resolved.origin, sourceLessonId: resolved.sourceLessonId ?? null, sourceLessonTitle: resolved.sourceLessonTitle ?? null, matchReason: resolved.matchReason };
}

export function sentenceWithResolvedAnnotations(sentence: StudySentence): StudySentence { return sentence; }

/**
 * Adds only high-confidence inherited annotations to uncovered sentence spans.
 * This is deliberately batch-oriented: callers provide lesson bodies already
 * loaded for a language pair, so matching never performs one lookup per token.
 */
export function resolveLessonAnnotations(lesson: StudyLesson, lessons: StudyLesson[]): StudyLesson {
  const candidates = lessons
    .filter((candidateLesson) => candidateLesson.id !== lesson.id
      && candidateLesson.language === lesson.language
      && candidateLesson.baseLanguage === lesson.baseLanguage)
    .flatMap((candidateLesson) => annotationsForLesson(candidateLesson));

  if (!candidates.length) return lesson;
  return {
    ...lesson,
    sentences: lesson.sentences.map((sentence) => resolveSentenceAnnotations(sentence, lesson, candidates))
  };
}

type AnyCandidate = AnnotationCandidate<TargetAnnotation> & { kind: AnnotationKind };

function annotationsForLesson(lesson: StudyLesson): AnyCandidate[] {
  return lesson.sentences.flatMap((sentence) => [
    ...sentence.words.filter((annotation) => annotation.annotationOrigin !== "shared").map((annotation) => ({ annotation, kind: "word" as const })),
    ...sentence.grammar.filter((annotation) => annotation.annotationOrigin !== "shared").map((annotation) => ({ annotation, kind: "grammar" as const })),
    ...sentence.chunks.filter((annotation) => annotation.annotationOrigin !== "shared").map((annotation) => ({ annotation, kind: "chunk" as const }))
  ].map(({ annotation, kind }) => ({
    annotation,
    kind,
    language: lesson.language,
    baseLanguage: lesson.baseLanguage,
    sourceLessonId: lesson.id,
    sourceLessonTitle: lesson.title
  })));
}

function resolveSentenceAnnotations(sentence: StudySentence, lesson: StudyLesson, candidates: AnyCandidate[]): StudySentence {
  const next = { ...sentence, words: [...sentence.words], grammar: [...sentence.grammar], chunks: [...sentence.chunks] };
  (Object.entries({ word: next.words, grammar: next.grammar, chunk: next.chunks }) as [AnnotationKind, TargetAnnotation[]][])
    .forEach(([kind, local]) => {
      const localSurfaces = new Set(local.map((annotation) => `${canonicalTarget(annotation, kind)}\u001f${normalizedSurface(annotation, kind)}`));
      const grouped = new Map<string, AnyCandidate[]>();
      for (const candidate of candidates.filter((item) => item.kind === kind && containsNormalized(sentence.text, annotationTargetText(item.annotation, kind)))) {
        const key = `${canonicalTarget(candidate.annotation, kind)}\u001f${normalizedSurface(candidate.annotation, kind)}`;
        if (localSurfaces.has(key)) continue;
        const entries = grouped.get(key) ?? [];
        entries.push(candidate);
        grouped.set(key, entries);
      }
      for (const entries of grouped.values()) {
        const source = entries[0];
        const resolved = resolveAnnotation(source.annotation, undefined, kind, lesson.language, lesson.baseLanguage, entries);
        if (!resolved || resolved.origin !== "shared") continue;
        // Only the deterministically selected source is materialized. Identical
        // annotations therefore do not create duplicate overlapping highlights.
        if (resolved.sourceLessonId !== source.sourceLessonId) continue;
        local.push(withResolvedAnnotationMetadata(source.annotation, resolved));
      }
    });
  return next;
}

function containsNormalized(text: string, target: string): boolean {
  const source = normalize(text);
  const needle = normalize(target);
  return Boolean(needle) && source.includes(needle);
}
