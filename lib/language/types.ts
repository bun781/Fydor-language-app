export type LearningItemType = "word" | "grammar" | "chunk";
export type SentenceDrillType = "recall" | "reconstruction" | "cloze" | "transformation" | "original_sentence";
export type SentenceGrade = "easy" | "correct" | "hard" | "failed";

export interface LessonFocusInput {
  type: LearningItemType;
  canonicalKey: string;
  displayText: string;
  meaning?: string;
  explanation?: string;
  commonMistakes?: string[];
}

export interface LessonTokenInput {
  text: string;
  type?: LearningItemType;
  canonicalKey?: string;
  meaning?: string;
  explanation?: string;
  commonMistakes?: string[];
}

export interface LessonDrillsInput {
  recallPrompt?: string;
  clozePrompt?: string;
  clozeAnswer?: string;
  transformPrompt?: string;
  transformAnswer?: string;
}

export interface LessonSentenceInput {
  text: string;
  translation: string;
  focus?: LessonFocusInput;
  tokens?: LessonTokenInput[];
  drills?: LessonDrillsInput;
}

export interface LessonImportInput {
  targetLanguage: string;
  baseLanguage: string;
  level?: string;
  title: string;
  sentences: LessonSentenceInput[];
}

export interface ImportWarning {
  code: string;
  message: string;
  sentenceIndex?: number;
  canonicalKey?: string;
}

export interface ImportValidationResult {
  lesson?: LessonImportInput;
  errors: string[];
  warnings: ImportWarning[];
}

export interface DrillBlueprint {
  type: SentenceDrillType;
  prompt: string;
  answer: string;
  payload: Record<string, unknown>;
}

export interface LearningItemPreview {
  canonicalKey: string;
  type: LearningItemType;
  displayText: string;
  meaning?: string;
  explanation?: string;
  commonMistakes: string[];
  status: "existing" | "new" | "conflict";
  existingId?: string;
  conflictMessage?: string;
}

export interface SentencePreview {
  index: number;
  text: string;
  translation: string;
  focus?: LessonFocusInput;
  tokens: LessonTokenInput[];
  drills: DrillBlueprint[];
  duplicateSentence: boolean;
}

export interface ImportPreviewResult {
  sourceHash: string;
  lesson: LessonImportInput;
  sentences: SentencePreview[];
  learningItems: LearningItemPreview[];
  warnings: ImportWarning[];
  duplicateImport: boolean;
}
