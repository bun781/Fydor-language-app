import type { QuizQuestion, SelectedItem, StudySentence } from "./types";

export function findRelatedSentences(
  current: StudySentence,
  all: StudySentence[],
  selected: SelectedItem | null,
  max = 3
): Array<{ sentence: StudySentence; reason: string }> {
  if (!selected) return [];
  const results: Array<{ sentence: StudySentence; reason: string }> = [];

  for (const sentence of all) {
    if (results.length >= max) break;
    if (sentence.id === current.id) continue;

    if (selected.kind === "word") {
      const key = selected.data.canonicalKey;
      if (sentence.words.some((w) => w.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.surface}"` });
      }
    } else if (selected.kind === "grammar") {
      const key = selected.data.canonicalKey;
      if (sentence.grammar.some((g) => g.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.pattern}"` });
      }
    } else if (selected.kind === "chunk") {
      const key = selected.data.canonicalKey;
      if (sentence.chunks.some((c) => c.canonicalKey === key)) {
        results.push({ sentence, reason: `Uses "${selected.data.surfaceText}"` });
      }
    }
  }

  return results;
}

export function getHint(sentence: StudySentence): string | null {
  const firstWord = sentence.words.find((w) => w.meaning);
  if (firstWord) return `${firstWord.surface} = ${firstWord.meaning}`;
  const firstGrammar = sentence.grammar.find((g) => g.meaning);
  if (firstGrammar) return `${firstGrammar.surfaceText} = ${firstGrammar.meaning}`;
  return null;
}

export function generateQuizQuestion(
  recent: StudySentence[],
  all: StudySentence[]
): QuizQuestion | null {
  const wordsWithMeanings = recent
    .flatMap((s) => s.words.map((w) => ({ ...w, sentenceId: s.id, sentenceText: s.text })))
    .filter((w) => w.meaning);

  if (!wordsWithMeanings.length) return null;

  const target = wordsWithMeanings[Math.floor(Math.random() * wordsWithMeanings.length)];

  const distractors = [
    ...new Set(
      all
        .flatMap((s) => s.words)
        .filter((w) => w.meaning && w.canonicalKey !== target.canonicalKey)
        .map((w) => w.meaning as string)
    )
  ].slice(0, 3);

  if (distractors.length < 2) {
    return {
      type: "fill-blank",
      prompt: target.sentenceText.replace(target.surface, "____"),
      answer: target.surface,
      sentenceId: target.sentenceId
    };
  }

  return {
    type: "multiple-choice",
    prompt: `What does "${target.surface}" mean?`,
    options: shuffle([target.meaning as string, ...distractors.slice(0, 3)]),
    answer: target.meaning as string,
    sentenceId: target.sentenceId
  };
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
