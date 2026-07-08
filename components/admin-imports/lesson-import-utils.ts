import { z } from "zod";
import { findLanguageOption } from "@/lib/language/importResources";
import type { LessonImportInput, LessonSentenceInput } from "@/lib/language/types";

export const sampleLesson = `{
  "title": "Beginner Korean Lesson 1",
  "language": "ko",
  "baseLanguage": "en",
  "level": "beginner",
  "source": "ai_generated",
  "tags": ["daily", "travel"],
  "description": "Basic greetings and movement",
  "sentences": [
    {
      "text": "저는 학교에 갑니다.",
      "translation": "I go to school.",
      "words": [
        {
          "surface": "저는",
          "lemma": "저",
          "meaning": "I / me",
          "role": "topic-marked pronoun"
        }
      ],
      "grammar": [
        {
          "pattern": "N은/는",
          "surface": "저는",
          "meaning": "Topic marker",
          "explanation": "Marks the topic of the sentence."
        }
      ],
      "chunks": [
        {
          "surface": "학교에 갑니다",
          "meaning": "go to school",
          "explanation": "A common movement phrase using destination marker 에.",
          "type": "phrase",
          "level": "beginner",
          "tags": ["movement", "school"]
        }
      ]
    }
  ]
}`;

export const LESSON_IMPORT_DRAFT_KEY = "fydor:lesson-import-draft";

export function createEmptySentence(): LessonSentenceInput {
  return {
    text: "",
    translation: "",
    words: [],
    grammar: [],
    chunks: []
  };
}

export const initialLesson: LessonImportInput = {
  language: "ko",
  baseLanguage: "en",
  title: "New lesson",
  description: "",
  source: "lesson_builder",
  level: "beginner",
  tags: [],
  sentences: [createEmptySentence()]
};

export interface AnnotationDraft {
  kind: "word" | "grammar" | "chunk";
  surface: string;
  lemma: string;
  pattern: string;
  meaning: string;
  explanation: string;
  role: string;
  chunkType: string;
  level: string;
  tags: string;
}

export interface SelectedSpan {
  start: number;
  end: number;
  surface: string;
}

export function createDraft(surface = ""): AnnotationDraft {
  return {
    kind: "word",
    surface,
    lemma: "",
    pattern: "",
    meaning: "",
    explanation: "",
    role: "",
    chunkType: "phrase",
    level: "",
    tags: ""
  };
}

export function stringifyLesson(lesson: LessonImportInput): string {
  return JSON.stringify(cleanLesson(lesson), null, 2);
}

function cleanLesson(lesson: LessonImportInput): LessonImportInput {
  return dropEmpty({
    ...lesson,
    tags: lesson.tags?.filter(Boolean),
    sentences: lesson.sentences.map((sentence) =>
      dropEmpty({
        ...sentence,
        words: sentence.words?.map((word) => dropEmpty(word)).filter((word) => word.surface),
        grammar: sentence.grammar?.map((grammar) => dropEmpty(grammar)).filter((grammar) => grammar.pattern),
        chunks: sentence.chunks?.map((chunk) => dropEmpty(chunk)).filter((chunk) => chunk.surface)
      })
    )
  });
}

export function pruneEmpty<T extends object>(item: T): T {
  return dropEmpty(item);
}

function dropEmpty<T extends object>(item: T): T {
  return Object.fromEntries(
    Object.entries(item).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== "" && value !== undefined && value !== null;
    })
  ) as T;
}

export function splitTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function resolveLanguageValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return findLanguageOption(trimmed)?.code ?? trimmed;
}

export function formatLanguageDisplay(value: string): string {
  if (!value) return "";

  const match = findLanguageOption(value);
  if (!match) return value;

  return `${match.label} (${match.code})`;
}

export function getCharIndex(node: Node | null): number | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const char = element?.closest<HTMLElement>("[data-char-index]");
  const value = char?.dataset.charIndex;
  return value === undefined ? null : Number(value);
}

export type WorkspaceMode = "builder" | "json" | "lessons";

// Structural check only — the Rust import pipeline is the real validator for lesson content.
const lessonImportInputSchema = z.custom<LessonImportInput>((value) => {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Partial<LessonImportInput>;
  return (
    typeof lesson.language === "string" &&
    typeof lesson.baseLanguage === "string" &&
    typeof lesson.title === "string" &&
    Array.isArray(lesson.sentences)
  );
});

export const lessonManagerProgressSchema = z.object({
  mode: z.enum(["builder", "json", "lessons"]),
  lesson: lessonImportInputSchema,
  activeSentenceIndex: z.number().int(),
  draft: z.object({
    kind: z.enum(["word", "grammar", "chunk"]),
    surface: z.string(),
    lemma: z.string(),
    pattern: z.string(),
    meaning: z.string(),
    explanation: z.string(),
    role: z.string(),
    chunkType: z.string(),
    level: z.string(),
    tags: z.string()
  }),
  source: z.string(),
  appendSource: z.string(),
  targetLessonId: z.string(),
  editorLessonId: z.string().nullable(),
  selectedLibraryLessonId: z.string().nullable(),
  // Older saved progress predates baselineSource; treating the restored draft as
  // unsaved (baseline = pristine lesson) errs on the side of asking before discarding.
  baselineSource: z.string().catch(() => stringifyLesson(initialLesson))
}).transform((item) => ({
  ...item,
  activeSentenceIndex: clampSentenceIndex(item.activeSentenceIndex, item.lesson)
}));

export type LessonManagerProgress = z.infer<typeof lessonManagerProgressSchema>;

export function clampSentenceIndex(index: number, lesson: LessonImportInput) {
  return Math.min(Math.max(0, index), Math.max(0, lesson.sentences.length - 1));
}

export function slugifyLessonTitle(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lesson";
}

export function extractAppendSentences(value: unknown): LessonSentenceInput[] {
  if (Array.isArray(value)) {
    return value as LessonSentenceInput[];
  }

  if (isRecord(value) && Array.isArray(value.sentences)) {
    return value.sentences as LessonSentenceInput[];
  }

  if (isRecord(value) && isRecord(value.sentence)) {
    return [value.sentence as unknown as LessonSentenceInput];
  }

  if (isRecord(value) && typeof value.text === "string") {
    return [value as unknown as LessonSentenceInput];
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getCharAnnotationClassName(sentence: LessonSentenceInput, char: string, index: number): string | undefined {
  if (!sentence.text || char.trim() === "") return undefined;
  const left = Array.from(sentence.text).slice(0, index).join("");
  const right = Array.from(sentence.text).slice(0, index + 1).join("");

  function overlaps(surface: string | undefined): boolean {
    if (!surface) return false;
    const start = sentence.text.indexOf(surface);
    if (start < 0) return false;
    const end = start + surface.length;
    return left.length >= start && right.length <= end;
  }

  const classes = [
    (sentence.words ?? []).some((w) => overlaps(w.surface)) ? "annotated-has-word" : null,
    (sentence.grammar ?? []).some((g) => overlaps(g.surface)) ? "annotated-has-grammar" : null,
    (sentence.chunks ?? []).some((c) => overlaps(c.surface)) ? "annotated-has-chunk" : null
  ].filter(Boolean);

  return classes.length ? classes.join(" ") : undefined;
}
