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

export function cleanLesson(lesson: LessonImportInput): LessonImportInput {
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

export function dropEmpty<T extends object>(item: T): T {
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

export interface LessonManagerProgress {
  mode: WorkspaceMode;
  lesson: LessonImportInput;
  activeSentenceIndex: number;
  draft: AnnotationDraft;
  source: string;
  appendSource: string;
  targetLessonId: string;
  editorLessonId: string | null;
  selectedLibraryLessonId: string | null;
}

export function validateLessonManagerProgress(value: unknown): LessonManagerProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<LessonManagerProgress>;

  if (!isWorkspaceMode(item.mode)) return null;
  if (!isLessonImportInput(item.lesson)) return null;
  if (typeof item.activeSentenceIndex !== "number" || !Number.isInteger(item.activeSentenceIndex)) return null;
  if (!isAnnotationDraft(item.draft)) return null;
  if (typeof item.source !== "string") return null;
  if (typeof item.appendSource !== "string") return null;
  if (typeof item.targetLessonId !== "string") return null;
  if (item.editorLessonId !== null && typeof item.editorLessonId !== "string") return null;
  if (item.selectedLibraryLessonId !== null && typeof item.selectedLibraryLessonId !== "string") return null;

  return {
    mode: item.mode,
    lesson: item.lesson,
    activeSentenceIndex: clampSentenceIndex(item.activeSentenceIndex, item.lesson),
    draft: item.draft,
    source: item.source,
    appendSource: item.appendSource,
    targetLessonId: item.targetLessonId,
    editorLessonId: item.editorLessonId,
    selectedLibraryLessonId: item.selectedLibraryLessonId
  };
}

export function clampSentenceIndex(index: number, lesson: LessonImportInput) {
  return Math.min(Math.max(0, index), Math.max(0, lesson.sentences.length - 1));
}

function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === "builder" || value === "json" || value === "lessons";
}

function isLessonImportInput(value: unknown): value is LessonImportInput {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Partial<LessonImportInput>;
  return (
    typeof lesson.language === "string" &&
    typeof lesson.baseLanguage === "string" &&
    typeof lesson.title === "string" &&
    Array.isArray(lesson.sentences)
  );
}

function isAnnotationDraft(value: unknown): value is AnnotationDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<AnnotationDraft>;
  return (
    (draft.kind === "word" || draft.kind === "grammar" || draft.kind === "chunk") &&
    typeof draft.surface === "string" &&
    typeof draft.lemma === "string" &&
    typeof draft.pattern === "string" &&
    typeof draft.meaning === "string" &&
    typeof draft.explanation === "string" &&
    typeof draft.role === "string" &&
    typeof draft.chunkType === "string" &&
    typeof draft.level === "string" &&
    typeof draft.tags === "string"
  );
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
