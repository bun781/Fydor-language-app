import type { AnnotationRange } from "./text-spans";
import { buildClozeCandidates, type ClozeCandidate } from "./study-utils";
import { stableShuffle } from "./stableShuffle";
import { tokenizeText } from "./text-spans";
import type { StudySentence } from "./types";

export type ExerciseKind = "cloze" | "reorder" | "typed-recall";

export interface BaseExercise {
  id: string;
  kind: ExerciseKind;
  sentenceId: string;
  sentenceText: string;
  translation: string;
}

export interface ClozeExercise extends BaseExercise {
  kind: "cloze";
  answer: string;
  before: string;
  after: string;
  focusKind: AnnotationRange["kind"];
  clue: string | null;
}

export interface ReorderExercise extends BaseExercise {
  kind: "reorder";
  answerTokens: string[];
  scrambledTokens: string[];
}

export interface TypedRecallExercise extends BaseExercise {
  kind: "typed-recall";
  prompt: string;
  answer: string;
}

export type GeneratedExercise = ClozeExercise | ReorderExercise | TypedRecallExercise;

export interface GenerateExerciseOptions {
  seed?: string;
  locale?: string;
  include?: ExerciseKind[];
}

export function generateExercisesForSentence(
  sentence: StudySentence,
  options: GenerateExerciseOptions = {}
): GeneratedExercise[] {
  const include = new Set(options.include ?? ["cloze", "reorder", "typed-recall"]);
  const exercises: GeneratedExercise[] = [];

  if (include.has("cloze")) {
    const cloze = generateClozeExercise(sentence, options.seed);
    if (cloze) exercises.push(cloze);
  }

  if (include.has("reorder")) {
    const reorder = generateReorderExercise(sentence, options);
    if (reorder) exercises.push(reorder);
  }

  if (include.has("typed-recall")) {
    const typedRecall = generateTypedRecallExercise(sentence);
    if (typedRecall) exercises.push(typedRecall);
  }

  return exercises;
}

export function generateExercises(
  sentences: StudySentence[],
  options: GenerateExerciseOptions = {}
): GeneratedExercise[] {
  return sentences.flatMap((sentence) => generateExercisesForSentence(sentence, options));
}

export function generateClozeExercise(sentence: StudySentence, seed = ""): ClozeExercise | null {
  const candidate = pickClozeCandidate(sentence, seed);
  if (!candidate) return null;

  return {
    ...baseExercise(sentence, "cloze", candidate.id),
    kind: "cloze",
    answer: candidate.answerText,
    before: sentence.text.slice(0, candidate.start),
    after: sentence.text.slice(candidate.end),
    focusKind: candidate.kind,
    clue: candidate.meaning ?? candidate.explanation
  };
}

export function generateReorderExercise(
  sentence: StudySentence,
  options: GenerateExerciseOptions = {}
): ReorderExercise | null {
  const tokens = tokenizeText(sentence.text, options.locale)
    .filter((token) => token.isWordLike)
    .map((token) => token.text);

  if (tokens.length < 2) return null;

  const scrambled = stableShuffle(tokens, `${sentence.id}:${options.seed ?? ""}:reorder`);
  if (scrambled.every((token, index) => token === tokens[index])) {
    [scrambled[0], scrambled[1]] = [scrambled[1], scrambled[0]];
  }

  return {
    ...baseExercise(sentence, "reorder"),
    kind: "reorder",
    answerTokens: tokens,
    scrambledTokens: scrambled
  };
}

export function generateTypedRecallExercise(sentence: StudySentence): TypedRecallExercise | null {
  if (!sentence.translation.trim() || !sentence.text.trim()) return null;

  return {
    ...baseExercise(sentence, "typed-recall"),
    kind: "typed-recall",
    prompt: sentence.translation,
    answer: sentence.text
  };
}

function pickClozeCandidate(sentence: StudySentence, seed = ""): ClozeCandidate | null {
  const candidates = buildClozeCandidates(sentence);
  if (!candidates.length) return null;
  return stableShuffle(candidates, `${sentence.id}:${seed}:cloze`)[0];
}

function baseExercise(sentence: StudySentence, kind: ExerciseKind, suffix = ""): BaseExercise {
  return {
    id: [sentence.id, kind, suffix].filter(Boolean).join(":"),
    kind,
    sentenceId: sentence.id,
    sentenceText: sentence.text,
    translation: sentence.translation
  };
}
