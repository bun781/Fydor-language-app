export type ReadingTokenKind = "word" | "number" | "punctuation" | "space" | "symbol";

export interface ReadingToken {
  text: string;
  start: number;
  end: number;
  kind: ReadingTokenKind;
  isWordLike: boolean;
  normalized: string;
}

const LETTER_RE = /\p{L}|\p{M}/u;
const NUMBER_RE = /\p{N}/u;
const SPACE_RE = /\s/u;
const PUNCTUATION_RE = /\p{P}/u;
const HAN_RE = /\p{Script=Han}/u;

export function tokenizeForReading(source: string, locale?: string): ReadingToken[] {
  if (!source) return [];

  const Segmenter = Intl.Segmenter;
  if (Segmenter) {
    const segmenter = new Segmenter(locale, { granularity: "word" });
    return Array.from(segmenter.segment(source), (segment) => tokenFromSegment(
      segment.segment,
      segment.index,
      segment.index + segment.segment.length,
      Boolean(segment.isWordLike)
    ));
  }

  return fallbackTokenizeForReading(source);
}

export function normalizeTokenText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim();
}

function fallbackTokenizeForReading(source: string): ReadingToken[] {
  const tokens: ReadingToken[] = [];
  let current: ReadingToken | null = null;

  for (const point of iterateCodePoints(source)) {
    const kind = classifyTokenText(point.text);
    const isWordLike = kind === "word" || kind === "number";
    const shouldSplit = kind === "word" && HAN_RE.test(point.text);

    if (current && !shouldSplit && current.kind === kind && current.isWordLike === isWordLike) {
      current.text += point.text;
      current.end = point.end;
      current.normalized = normalizeTokenText(current.text);
      continue;
    }

    current = {
      text: point.text,
      start: point.start,
      end: point.end,
      kind,
      isWordLike,
      normalized: normalizeTokenText(point.text)
    };
    tokens.push(current);
  }

  return tokens;
}

function tokenFromSegment(text: string, start: number, end: number, isWordLike: boolean): ReadingToken {
  const kind = isWordLike ? wordLikeKind(text) : classifyTokenText(text);
  return {
    text,
    start,
    end,
    kind,
    isWordLike: isWordLike || kind === "word" || kind === "number",
    normalized: normalizeTokenText(text)
  };
}

function wordLikeKind(text: string): ReadingTokenKind {
  return NUMBER_RE.test(text) && !LETTER_RE.test(text) ? "number" : "word";
}

function classifyTokenText(text: string): ReadingTokenKind {
  if (SPACE_RE.test(text)) return "space";
  if (LETTER_RE.test(text)) return "word";
  if (NUMBER_RE.test(text)) return "number";
  if (PUNCTUATION_RE.test(text)) return "punctuation";
  return "symbol";
}

function iterateCodePoints(source: string): Array<{ text: string; start: number; end: number }> {
  const points: Array<{ text: string; start: number; end: number }> = [];
  let index = 0;

  for (const text of source) {
    const start = index;
    const end = start + text.length;
    points.push({ text, start, end });
    index = end;
  }

  return points;
}
