// Reviewable units generalize review beyond whole sentences: a unit is anything the
// scheduler can track (sentence, word, grammar pattern, chunk). Item-type units are keyed
// by canonical key (same identity rule as learning_items in SQLite), so the same word seen
// in ten lessons is one unit with ten sentence examples.
import type { StudySentence } from "@/lib/imported-content/types";

export type ReviewableUnitType = "sentence" | "word" | "grammar" | "chunk";

export interface ReviewExample {
  sentenceId: string;
  text: string;
  translation: string;
  /** Surface form of the item inside this sentence; null for sentence units. */
  surfaceText: string | null;
}

export interface ReviewableUnit {
  /** Stable identity: `sentence:<sentenceId>` or `<type>:<canonicalKey>`. */
  unitKey: string;
  type: ReviewableUnitType;
  /** Canonical key shared with learning_items; null for sentence units. */
  canonicalKey: string | null;
  displayText: string;
  meaning: string | null;
  examples: ReviewExample[];
}

// ":" also appears inside canonical keys ("ko:hello"), so parseUnitKey splits on the first colon only.
const UNIT_KEY_SEPARATOR = ":";

export function makeUnitKey(type: ReviewableUnitType, identity: string): string {
  return `${type}${UNIT_KEY_SEPARATOR}${identity}`;
}

export function parseUnitKey(unitKey: string): { type: ReviewableUnitType; identity: string } | null {
  const separatorIndex = unitKey.indexOf(UNIT_KEY_SEPARATOR);
  if (separatorIndex < 0) return null;
  const type = unitKey.slice(0, separatorIndex);
  const identity = unitKey.slice(separatorIndex + 1);
  if (!identity) return null;
  if (type !== "sentence" && type !== "word" && type !== "grammar" && type !== "chunk") return null;
  return { type, identity };
}

export function sentenceToReviewableUnit(sentence: StudySentence): ReviewableUnit {
  return {
    unitKey: makeUnitKey("sentence", sentence.id),
    type: "sentence",
    canonicalKey: null,
    displayText: sentence.text,
    meaning: sentence.translation || null,
    examples: [
      { sentenceId: sentence.id, text: sentence.text, translation: sentence.translation, surfaceText: null }
    ]
  };
}

export function getReviewableUnitsForSentence(sentence: StudySentence): ReviewableUnit[] {
  const units: ReviewableUnit[] = [sentenceToReviewableUnit(sentence)];

  for (const word of sentence.words) {
    units.push({
      unitKey: makeUnitKey("word", word.canonicalKey),
      type: "word",
      canonicalKey: word.canonicalKey,
      displayText: word.displayText,
      meaning: word.meaning,
      examples: [
        { sentenceId: sentence.id, text: sentence.text, translation: sentence.translation, surfaceText: word.surface }
      ]
    });
  }

  for (const grammar of sentence.grammar) {
    units.push({
      unitKey: makeUnitKey("grammar", grammar.canonicalKey),
      type: "grammar",
      canonicalKey: grammar.canonicalKey,
      displayText: grammar.pattern,
      meaning: grammar.meaning,
      examples: [
        { sentenceId: sentence.id, text: sentence.text, translation: sentence.translation, surfaceText: grammar.surfaceText }
      ]
    });
  }

  for (const chunk of sentence.chunks) {
    units.push({
      unitKey: makeUnitKey("chunk", chunk.canonicalKey),
      type: "chunk",
      canonicalKey: chunk.canonicalKey,
      displayText: chunk.surfaceText,
      meaning: chunk.meaning,
      examples: [
        { sentenceId: sentence.id, text: sentence.text, translation: sentence.translation, surfaceText: chunk.surfaceText }
      ]
    });
  }

  return units;
}

/** Collect units across sentences, merging duplicate items into one unit with all examples. */
export function collectReviewableUnits(sentences: StudySentence[]): Map<string, ReviewableUnit> {
  const units = new Map<string, ReviewableUnit>();

  for (const sentence of sentences) {
    for (const unit of getReviewableUnitsForSentence(sentence)) {
      const existing = units.get(unit.unitKey);
      if (!existing) {
        units.set(unit.unitKey, unit);
        continue;
      }
      for (const example of unit.examples) {
        if (!existing.examples.some((candidate) => candidate.sentenceId === example.sentenceId)) {
          existing.examples.push(example);
        }
      }
      if (!existing.meaning && unit.meaning) existing.meaning = unit.meaning;
    }
  }

  return units;
}

export function getCanonicalItemsForSentence(sentence: StudySentence): ReviewableUnit[] {
  return getReviewableUnitsForSentence(sentence).filter((unit) => unit.type !== "sentence");
}

export function getExamplesForReviewableUnit(
  unitKey: string,
  sentences: StudySentence[]
): ReviewExample[] {
  return collectReviewableUnits(sentences).get(unitKey)?.examples ?? [];
}

export function getSentencesForCanonicalItem(
  type: Exclude<ReviewableUnitType, "sentence">,
  canonicalKey: string,
  sentences: StudySentence[]
): StudySentence[] {
  const matches = (sentence: StudySentence) => {
    if (type === "word") return sentence.words.some((word) => word.canonicalKey === canonicalKey);
    if (type === "grammar") return sentence.grammar.some((grammar) => grammar.canonicalKey === canonicalKey);
    return sentence.chunks.some((chunk) => chunk.canonicalKey === canonicalKey);
  };
  return sentences.filter(matches);
}

/**
 * The best example for reviewing an item is the sentence with the least competing
 * annotated material (lower cognitive load), tie-broken by shorter text, then id
 * for determinism.
 */
export function getBestSentenceExampleForItem(
  type: Exclude<ReviewableUnitType, "sentence">,
  canonicalKey: string,
  sentences: StudySentence[]
): StudySentence | null {
  const candidates = getSentencesForCanonicalItem(type, canonicalKey, sentences);
  if (!candidates.length) return null;

  const annotationCount = (sentence: StudySentence) =>
    sentence.words.length + sentence.grammar.length + sentence.chunks.length;

  return [...candidates].sort((a, b) => (
    annotationCount(a) - annotationCount(b)
    || a.text.length - b.text.length
    || a.id.localeCompare(b.id)
  ))[0];
}
