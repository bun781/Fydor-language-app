import type { StudySentence } from "./types";

export interface SentenceCoverage {
  sentenceId: string;
  totalItems: number;
  knownItems: number;
  unknownItems: string[];
  coveragePercent: number;
  isIPlusOne: boolean;
}

export interface LessonCoverageSummary {
  sentenceCount: number;
  totalCanonicalItems: number;
  knownCanonicalItems: number;
  unknownCanonicalItems: number;
  coveragePercent: number;
  iPlusOneSentenceIds: string[];
}

export function getCanonicalKeysForSentence(sentence: StudySentence): string[] {
  const keys = new Set<string>();

  for (const word of sentence.words) keys.add(word.canonicalKey);
  for (const grammar of sentence.grammar) keys.add(grammar.canonicalKey);
  for (const chunk of sentence.chunks) keys.add(chunk.canonicalKey);

  return [...keys];
}

export function analyzeSentenceCoverage(
  sentence: StudySentence,
  knownCanonicalKeys: Iterable<string>
): SentenceCoverage {
  const known = new Set(knownCanonicalKeys);
  const canonicalKeys = getCanonicalKeysForSentence(sentence);
  const unknownItems = canonicalKeys.filter((key) => !known.has(key));
  const knownItems = canonicalKeys.length - unknownItems.length;

  return {
    sentenceId: sentence.id,
    totalItems: canonicalKeys.length,
    knownItems,
    unknownItems,
    coveragePercent: percent(knownItems, canonicalKeys.length),
    isIPlusOne: unknownItems.length === 1
  };
}

export function summarizeLessonCoverage(
  sentences: StudySentence[],
  knownCanonicalKeys: Iterable<string>
): LessonCoverageSummary {
  const known = new Set(knownCanonicalKeys);
  const allKeys = new Set<string>();
  const knownKeys = new Set<string>();
  const iPlusOneSentenceIds: string[] = [];

  for (const sentence of sentences) {
    const coverage = analyzeSentenceCoverage(sentence, known);
    if (coverage.isIPlusOne) iPlusOneSentenceIds.push(sentence.id);

    for (const key of getCanonicalKeysForSentence(sentence)) {
      allKeys.add(key);
      if (known.has(key)) knownKeys.add(key);
    }
  }

  return {
    sentenceCount: sentences.length,
    totalCanonicalItems: allKeys.size,
    knownCanonicalItems: knownKeys.size,
    unknownCanonicalItems: allKeys.size - knownKeys.size,
    coveragePercent: percent(knownKeys.size, allKeys.size),
    iPlusOneSentenceIds
  };
}

export function sortSentencesForComprehensibleInput(
  sentences: StudySentence[],
  knownCanonicalKeys: Iterable<string>
): StudySentence[] {
  const known = new Set(knownCanonicalKeys);

  return [...sentences].sort((a, b) => {
    const aCoverage = analyzeSentenceCoverage(a, known);
    const bCoverage = analyzeSentenceCoverage(b, known);

    return rankCoverage(aCoverage) - rankCoverage(bCoverage)
      || bCoverage.coveragePercent - aCoverage.coveragePercent
      || a.text.length - b.text.length
      || a.id.localeCompare(b.id);
  });
}

function rankCoverage(coverage: SentenceCoverage): number {
  if (coverage.unknownItems.length === 0) return 0;
  if (coverage.isIPlusOne) return 1;
  return 2 + coverage.unknownItems.length;
}

function percent(value: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((value / total) * 100);
}
