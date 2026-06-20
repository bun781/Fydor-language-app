import type { DrillBlueprint, LessonSentenceInput } from "@/lib/language/types";

export function generateSentenceForgeDrills(sentence: LessonSentenceInput): DrillBlueprint[] {
  const tokens = sentence.tokens?.map((token) => token.text).filter(Boolean) ?? splitSentence(sentence.text);
  const focusAnswer = sentence.drills?.clozeAnswer ?? sentence.focus?.displayText ?? tokens.at(-1) ?? sentence.text;

  return [
    {
      type: "recall",
      prompt: sentence.drills?.recallPrompt ?? `Translate into target language: ${sentence.translation}`,
      answer: sentence.text,
      payload: {}
    },
    {
      type: "reconstruction",
      prompt: "Rebuild the sentence.",
      answer: sentence.text,
      payload: { tokens: shuffleStable(tokens) }
    },
    {
      type: "cloze",
      prompt: sentence.drills?.clozePrompt ?? buildClozePrompt(sentence.text, focusAnswer),
      answer: focusAnswer,
      payload: { hidden: focusAnswer }
    },
    {
      type: "transformation",
      prompt: sentence.drills?.transformPrompt ?? "Change the sentence as prompted by your teacher.",
      answer: sentence.drills?.transformAnswer ?? sentence.text,
      payload: {}
    },
    {
      type: "original_sentence",
      prompt: `Write one original sentence using ${sentence.focus?.displayText ?? "the focus item"}.`,
      answer: sentence.focus?.displayText ?? sentence.text,
      payload: { selfGraded: true }
    }
  ];
}

function splitSentence(sentence: string): string[] {
  const byWhitespace = sentence.trim().split(/\s+/).filter(Boolean);
  if (byWhitespace.length > 1) return byWhitespace;
  return Array.from(sentence.trim()).filter((character) => character.trim().length > 0);
}

function buildClozePrompt(sentence: string, answer: string): string {
  if (answer && sentence.includes(answer)) {
    return sentence.replace(answer, "____");
  }

  return `${sentence}\nFill the focus blank.`;
}

function shuffleStable(tokens: string[]): string[] {
  return tokens
    .map((token, index) => ({ token, rank: hashRank(`${token}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map(({ token }) => token);
}

function hashRank(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) % 9973;
  }
  return hash;
}
