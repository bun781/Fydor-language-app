import type { StudySentence } from "@/lib/imported-content/types";
import { normalizeTokenText, tokenizeForReading, type ReadingToken } from "./tokenizer";

export type ReadingItemType = "word" | "grammar" | "chunk";
export type ReadingKnowledgeStatus = "known" | "learning" | "unknown";

export interface ReadingLexiconEntry {
  type: ReadingItemType;
  canonicalKey: string;
  displayText: string;
  meaning: string | null;
  surfaces: string[];
  exampleSentenceIds: string[];
}

export interface ReadingTokenMatch {
  type: ReadingItemType;
  canonicalKey: string;
  displayText: string;
  meaning: string | null;
  status: Exclude<ReadingKnowledgeStatus, "unknown">;
}

export interface AnalyzedReadingToken extends ReadingToken {
  match: ReadingTokenMatch | null;
}

export interface ReadingCoverage {
  totalWordLikeTokens: number;
  matchedWordLikeTokens: number;
  knownWordLikeTokens: number;
  learningWordLikeTokens: number;
  unknownWordLikeTokens: number;
  knownPercent: number;
  unknownTokens: string[];
  learningCanonicalKeys: string[];
  unknownCanonicalKeys: string[];
  likelyDifficulty: "review" | "i+1" | "stretch" | "unsupported";
  isIPlusOne: boolean;
}

export interface ReadingAnalysis {
  tokens: AnalyzedReadingToken[];
  coverage: ReadingCoverage;
}

// Minimal analysis inputs returned by the Rust get_reading_inputs command, so large
// libraries do not require loading every full lesson. Mirrors ReadingInputs in
// src-tauri/src/models.rs.
export interface ReadingLexiconInput {
  itemType: ReadingItemType;
  canonicalKey: string;
  displayText: string;
  meaning: string | null;
  surfaces: string[];
}

export interface ReadingItemStateInput {
  itemType: ReadingItemType;
  canonicalKey: string;
  repetitions: number;
}

export interface ReadingInputs {
  lexicon: ReadingLexiconInput[];
  itemStates: ReadingItemStateInput[];
  rememberedSentenceKeys: string[];
}

export function lexiconInputsToEntries(inputs: ReadingLexiconInput[]): ReadingLexiconEntry[] {
  return inputs.map((input) => ({
    type: input.itemType,
    canonicalKey: input.canonicalKey,
    displayText: input.displayText,
    meaning: input.meaning,
    surfaces: input.surfaces,
    exampleSentenceIds: []
  }));
}

/**
 * Persisted item review state is the primary knowledge signal: an item graded to at
 * least one successful repetition is known; a graded item that has never been recalled
 * is learning. Remembered-sentence inference only fills in canonical keys that have no
 * item review row at all (the bridge for libraries reviewed before item-level state
 * existed).
 */
export function deriveReadingKnowledge(
  itemStates: ReadingItemStateInput[],
  rememberedSentenceKeys: Iterable<string>
): { knownCanonicalKeys: Set<string>; learningCanonicalKeys: Set<string> } {
  const knownCanonicalKeys = new Set<string>();
  const learningCanonicalKeys = new Set<string>();

  for (const state of itemStates) {
    if (state.repetitions > 0) knownCanonicalKeys.add(state.canonicalKey);
    else learningCanonicalKeys.add(state.canonicalKey);
  }
  for (const key of rememberedSentenceKeys) {
    if (!learningCanonicalKeys.has(key)) knownCanonicalKeys.add(key);
  }
  // A key can carry both a recalled row and a never-recalled row (same key, different
  // item types); successful recall wins.
  for (const key of knownCanonicalKeys) learningCanonicalKeys.delete(key);

  return { knownCanonicalKeys, learningCanonicalKeys };
}

export function buildReadingLexicon(sentences: StudySentence[]): ReadingLexiconEntry[] {
  const entries = new Map<string, ReadingLexiconEntry>();

  for (const sentence of sentences) {
    for (const word of sentence.words) {
      upsertEntry(entries, {
        type: "word",
        canonicalKey: word.canonicalKey,
        displayText: word.displayText,
        meaning: word.meaning,
        surfaces: [word.surface, word.displayText],
        exampleSentenceIds: [sentence.id]
      });
    }
    for (const grammar of sentence.grammar) {
      upsertEntry(entries, {
        type: "grammar",
        canonicalKey: grammar.canonicalKey,
        displayText: grammar.pattern,
        meaning: grammar.meaning,
        surfaces: [grammar.surfaceText, grammar.pattern],
        exampleSentenceIds: [sentence.id]
      });
    }
    for (const chunk of sentence.chunks) {
      upsertEntry(entries, {
        type: "chunk",
        canonicalKey: chunk.canonicalKey,
        displayText: chunk.surfaceText,
        meaning: chunk.meaning,
        surfaces: [chunk.surfaceText],
        exampleSentenceIds: [sentence.id]
      });
    }
  }

  return [...entries.values()];
}

export function analyzeReadingText(
  text: string,
  lexicon: ReadingLexiconEntry[],
  knownCanonicalKeys: Iterable<string>,
  options: { locale?: string; learningCanonicalKeys?: Iterable<string> } = {}
): ReadingAnalysis {
  const known = new Set(knownCanonicalKeys);
  const learning = new Set(options.learningCanonicalKeys ?? []);
  const lookup = buildSurfaceLookup(lexicon);
  const tokens = tokenizeForReading(text, options.locale).map<AnalyzedReadingToken>((token) => {
    if (!token.isWordLike) return { ...token, match: null };
    const entry = lookup.get(token.normalized);
    if (!entry) return { ...token, match: null };
    const status = known.has(entry.canonicalKey) ? "known" : "learning";
    if (status === "learning") learning.add(entry.canonicalKey);
    return {
      ...token,
      match: {
        type: entry.type,
        canonicalKey: entry.canonicalKey,
        displayText: entry.displayText,
        meaning: entry.meaning,
        status
      }
    };
  });

  return {
    tokens,
    coverage: summarizeReadingCoverage(tokens, known, learning)
  };
}

function summarizeReadingCoverage(
  tokens: AnalyzedReadingToken[],
  known: Set<string>,
  learning: Set<string>
): ReadingCoverage {
  const wordLike = tokens.filter((token) => token.isWordLike);
  const matched = wordLike.filter((token) => token.match);
  const knownTokens = matched.filter((token) => token.match?.status === "known");
  const learningTokens = matched.filter((token) => token.match?.status === "learning");
  const unknownTokens = wordLike.filter((token) => !token.match);
  const unknownCanonicalKeys = new Set<string>();

  for (const token of matched) {
    const key = token.match?.canonicalKey;
    if (key && !known.has(key) && !learning.has(key)) unknownCanonicalKeys.add(key);
  }

  const unknownCount = wordLike.length - knownTokens.length;
  return {
    totalWordLikeTokens: wordLike.length,
    matchedWordLikeTokens: matched.length,
    knownWordLikeTokens: knownTokens.length,
    learningWordLikeTokens: learningTokens.length,
    unknownWordLikeTokens: unknownTokens.length,
    knownPercent: percent(knownTokens.length, wordLike.length),
    unknownTokens: unique(unknownTokens.map((token) => token.normalized).filter(Boolean)),
    learningCanonicalKeys: unique(learningTokens.map((token) => token.match?.canonicalKey).filter(isString)),
    unknownCanonicalKeys: [...unknownCanonicalKeys],
    likelyDifficulty: classifyDifficulty(unknownCount, wordLike.length),
    isIPlusOne: unknownCount === 1
  };
}

function buildSurfaceLookup(lexicon: ReadingLexiconEntry[]): Map<string, ReadingLexiconEntry> {
  const lookup = new Map<string, ReadingLexiconEntry>();
  for (const entry of lexicon) {
    const surfaces = [...entry.surfaces].sort((a, b) => b.length - a.length);
    for (const surface of surfaces) {
      const normalized = normalizeTokenText(surface);
      if (normalized && !lookup.has(normalized)) lookup.set(normalized, entry);
    }
  }
  return lookup;
}

function upsertEntry(entries: Map<string, ReadingLexiconEntry>, next: ReadingLexiconEntry): void {
  const key = `${next.type}:${next.canonicalKey}`;
  const existing = entries.get(key);
  if (!existing) {
    entries.set(key, {
      ...next,
      surfaces: unique(next.surfaces.map(normalizeTokenText).filter(Boolean)),
      exampleSentenceIds: unique(next.exampleSentenceIds)
    });
    return;
  }

  existing.surfaces = unique([...existing.surfaces, ...next.surfaces.map(normalizeTokenText).filter(Boolean)]);
  existing.exampleSentenceIds = unique([...existing.exampleSentenceIds, ...next.exampleSentenceIds]);
  if (!existing.meaning && next.meaning) existing.meaning = next.meaning;
}

function classifyDifficulty(unknownCount: number, total: number): ReadingCoverage["likelyDifficulty"] {
  if (total === 0) return "unsupported";
  if (unknownCount === 0) return "review";
  if (unknownCount === 1) return "i+1";
  return unknownCount / total <= 0.2 ? "stretch" : "unsupported";
}

function percent(value: number, total: number): number {
  if (total === 0) return 100;
  return Math.round((value / total) * 100);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}
