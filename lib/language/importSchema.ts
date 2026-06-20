import { z } from "zod";
import type { ImportValidationResult } from "@/lib/language/types";

const itemTypeSchema = z.enum(["word", "grammar", "chunk"]);

const focusSchema = z.object({
  type: itemTypeSchema,
  canonicalKey: z.string().trim().min(1),
  displayText: z.string().trim().min(1),
  meaning: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  commonMistakes: z.array(z.string().trim().min(1)).optional()
});

const tokenSchema = z.object({
  text: z.string().trim().min(1),
  type: itemTypeSchema.optional(),
  canonicalKey: z.string().trim().min(1).optional(),
  meaning: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  commonMistakes: z.array(z.string().trim().min(1)).optional()
});

const drillsSchema = z.object({
  recallPrompt: z.string().trim().min(1).optional(),
  clozePrompt: z.string().trim().min(1).optional(),
  clozeAnswer: z.string().trim().min(1).optional(),
  transformPrompt: z.string().trim().min(1).optional(),
  transformAnswer: z.string().trim().min(1).optional()
});

export const lessonImportSchema = z.object({
  targetLanguage: z.string().trim().min(1, "Missing targetLanguage."),
  baseLanguage: z.string().trim().min(1, "Missing baseLanguage."),
  level: z.string().trim().optional(),
  title: z.string().trim().min(1, "Missing title."),
  sentences: z.array(z.object({
    text: z.string().trim().min(1, "Missing sentence."),
    translation: z.string().trim().min(1, "Missing translation."),
    focus: focusSchema.optional(),
    tokens: z.array(tokenSchema).optional(),
    drills: drillsSchema.optional()
  })).min(1, "Missing sentence.")
});

export function parseLessonJson(source: string): ImportValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch {
    return { errors: ["Invalid JSON."], warnings: [] };
  }

  const result = lessonImportSchema.safeParse(parsed);
  if (!result.success) {
    return {
      errors: result.error.issues.map((issue) => issue.message),
      warnings: []
    };
  }

  const warnings = result.data.sentences.flatMap((sentence, sentenceIndex) => {
    const sentenceWarnings = [];
    if (!sentence.tokens?.length) {
      sentenceWarnings.push({
        code: "missing_tokens",
        message: "Missing tokens.",
        sentenceIndex
      });
    }
    if (!sentence.drills) {
      sentenceWarnings.push({
        code: "missing_drills",
        message: "Missing drills.",
        sentenceIndex
      });
    }
    return sentenceWarnings;
  });

  return { lesson: result.data, errors: [], warnings };
}
