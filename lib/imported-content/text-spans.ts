import { tokenizeForReading, type ReadingToken } from "@/lib/reading/tokenizer";
import type { StudySentence } from "./types";

export interface TextSpan {
  start: number;
  end: number;
}

export type AnnotationKind = "word" | "grammar" | "chunk";

export interface AnnotationRange extends TextSpan {
  id: string;
  kind: AnnotationKind;
  displayText: string;
  answerText: string;
  meaning: string | null;
  explanation: string | null;
  origin?: "local" | "shared";
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  matchReason?: "local" | "canonical" | "normalized-surface" | "lemma" | "alias";
}

interface NormalizedChar {
  value: string;
  sourceIndex: number;
  sourceEndIndex: number;
}

const TOKEN_CHAR_RE = /[\p{L}\p{N}\p{M}]/u;

export type TextToken = Pick<ReadingToken, "text" | "start" | "end" | "isWordLike">;

export function normalizePracticeAnswer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function answersMatch(actual: string, expected: string): boolean {
  return normalizePracticeAnswer(actual) === normalizePracticeAnswer(expected);
}

export function tokenizeText(source: string, locale?: string): TextToken[] {
  return tokenizeForReading(source, locale).map(({ text, start, end, isWordLike }) => ({ text, start, end, isWordLike }));
}

export function buildAnnotationRanges(sentence: StudySentence): AnnotationRange[] {
  const ranges: AnnotationRange[] = [];

  sentence.words.forEach((word, index) => {
    for (const span of findTextSpans(sentence.text, word.surface)) {
      ranges.push({
        id: `word-${index}-${span.start}`,
        ...span,
        kind: "word",
        displayText: word.displayText,
        answerText: word.surface,
        meaning: word.meaning,
        explanation: word.explanation,
        origin: word.annotationOrigin ?? "local",
        sourceLessonId: word.sourceLessonId ?? null,
        sourceLessonTitle: word.sourceLessonTitle ?? null,
        matchReason: word.matchReason ?? "local"
      });
    }
  });

  sentence.grammar.forEach((grammar, index) => {
    for (const span of findTextSpans(sentence.text, grammar.surfaceText)) {
      ranges.push({
        id: `grammar-${index}-${span.start}`,
        ...span,
        kind: "grammar",
        displayText: grammar.pattern,
        answerText: grammar.surfaceText,
        meaning: grammar.meaning,
        explanation: grammar.explanation,
        origin: grammar.annotationOrigin ?? "local",
        sourceLessonId: grammar.sourceLessonId ?? null,
        sourceLessonTitle: grammar.sourceLessonTitle ?? null,
        matchReason: grammar.matchReason ?? "local"
      });
    }
  });

  sentence.chunks.forEach((chunk, index) => {
    for (const span of findTextSpans(sentence.text, chunk.surfaceText)) {
      ranges.push({
        id: `chunk-${index}-${span.start}`,
        ...span,
        kind: "chunk",
        displayText: chunk.surfaceText,
        answerText: chunk.surfaceText,
        meaning: chunk.meaning,
        explanation: chunk.explanation,
        origin: chunk.annotationOrigin ?? "local",
        sourceLessonId: chunk.sourceLessonId ?? null,
        sourceLessonTitle: chunk.sourceLessonTitle ?? null,
        matchReason: chunk.matchReason ?? "local"
      });
    }
  });

  return ranges;
}

export function findTextSpans(source: string, query: string): TextSpan[] {
  const exact = findExactSpans(source, query);
  if (exact.length) return exact;

  const normalizedSource = normalizeWithMap(source);
  const normalizedQuery = normalizeSpanSearchText(query);
  if (!normalizedSource.text || !normalizedQuery) return [];

  const spans: TextSpan[] = [];
  let offset = 0;
  while (offset < normalizedSource.text.length) {
    const matchIndex = normalizedSource.text.indexOf(normalizedQuery, offset);
    if (matchIndex < 0) break;

    const startChar = normalizedSource.chars[matchIndex];
    const endChar = normalizedSource.chars[matchIndex + normalizedQuery.length - 1];
    if (startChar && endChar) {
      const start = startChar.sourceIndex;
      const end = endChar.sourceEndIndex;
      if (isTokenBoundary(source[start - 1]) && isTokenBoundary(source[end])) {
        spans.push({ start, end });
      }
    }
    offset = matchIndex + Math.max(1, normalizedQuery.length);
  }

  return dedupeSpans(spans);
}

function findExactSpans(source: string, query: string): TextSpan[] {
  const spans: TextSpan[] = [];
  if (!query) return spans;

  let offset = 0;
  while (offset < source.length) {
    const matchIndex = source.indexOf(query, offset);
    if (matchIndex < 0) break;
    spans.push({ start: matchIndex, end: matchIndex + query.length });
    offset = matchIndex + Math.max(1, query.length);
  }

  return dedupeSpans(spans);
}

function normalizeWithMap(source: string): { text: string; chars: NormalizedChar[] } {
  const chars: NormalizedChar[] = [];

  for (const { text: raw, start, end } of iterateCodePoints(source)) {
    const normalized = normalizePracticeAnswer(raw);
    if (!normalized) continue;

    for (const value of normalized.replace(/\s/g, "")) {
      chars.push({ value, sourceIndex: start, sourceEndIndex: end });
    }
  }

  return {
    text: chars.map((char) => char.value).join(""),
    chars
  };
}

function iterateCodePoints(source: string): TextToken[] {
  const chars: TextToken[] = [];
  let index = 0;

  for (const text of source) {
    const start = index;
    const end = start + text.length;
    chars.push({ text, start, end, isWordLike: TOKEN_CHAR_RE.test(text) });
    index = end;
  }

  return chars;
}

function normalizeSpanSearchText(value: string): string {
  return normalizePracticeAnswer(value).replace(/\s/g, "");
}

function isTokenBoundary(value: string | undefined): boolean {
  return !value || !TOKEN_CHAR_RE.test(value);
}

function dedupeSpans(spans: TextSpan[]): TextSpan[] {
  const seen = new Set<string>();
  return spans.filter((span) => {
    const key = `${span.start}:${span.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return span.start < span.end;
  });
}
