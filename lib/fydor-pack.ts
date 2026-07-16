import { z } from "zod";
import type { LessonGrammarInput, LessonImportInput, LessonSentenceInput } from "@/lib/language/types";
import { parseStrictJson } from "@/lib/safeJson";

const FYDOR_PACK_TYPE = "fydor_pack";
const FYDOR_PACK_SCHEMA_VERSION = 1;

export interface FydorPackAuthor {
  name?: string;
  organization?: string;
  url?: string;
}

export interface FydorPackUnitManifestItem {
  id: string;
  title: string;
  position: number;
  lessonIndexes: number[];
}

export interface FydorPackUnitManifest {
  schemaVersion: 1;
  units: FydorPackUnitManifestItem[];
}

export interface FydorGrammarGuideSituation {
  title: string;
  explanation: string;
  unitIndexes: number[];
}

export interface FydorGrammarGuideRule {
  id: string;
  title: string;
  overview: string;
  situations: FydorGrammarGuideSituation[];
  contrasts?: string[];
  commonMistakes?: string[];
}

export interface FydorGrammarGuide {
  schemaVersion: 1;
  rules: FydorGrammarGuideRule[];
}

type FydorGrammarInput = LessonGrammarInput & { ruleId?: string };
type FydorSentenceInput = Omit<LessonSentenceInput, "grammar"> & { grammar?: FydorGrammarInput[] };
type FydorLessonInput = Omit<LessonImportInput, "sentences"> & { sentences: FydorSentenceInput[] };

export interface FydorPack {
  type: typeof FYDOR_PACK_TYPE;
  schemaVersion: typeof FYDOR_PACK_SCHEMA_VERSION;
  id: string;
  title: string;
  description?: string;
  author?: FydorPackAuthor;
  version: string;
  license?: string;
  language: string;
  baseLanguage: string;
  level?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  unitManifest?: FydorPackUnitManifest;
  grammarGuide?: FydorGrammarGuide;
  lessons: FydorLessonInput[];
}

export interface FydorPackValidation {
  pack?: FydorPack;
  errors: string[];
  warnings: string[];
  lessonErrors: Array<{ index: number; title: string; errors: string[] }>;
  annexErrors: string[];
  lessonCount: number;
  sentenceCount: number;
}

/**
 * Produces the content checksum used by Exchange. Only learning content and
 * the directional language pair participate in this value, so timestamps and
 * presentation metadata cannot make an immutable published version appear to
 * be a different lesson.
 */
export async function computeFydorPackChecksum(pack: FydorPack): Promise<string> {
  const canonical = canonicalizePack(pack);
  const bytes = new TextEncoder().encode(stableStringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const lessonWordSchema = z.object({
  surface: z.string().trim().min(1),
  lemma: z.string().trim().min(1).optional(),
  meaning: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional()
}).strict();

const lessonGrammarSchema = z.object({
  pattern: z.string().trim().min(1),
  surface: z.string().trim().min(1).optional(),
  meaning: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional(),
  ruleId: z.string().trim().min(1).optional()
}).strict();

const lessonChunkSchema = z.object({
  surface: z.string().trim().min(1),
  meaning: z.string().trim().min(1).optional(),
  explanation: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  level: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim().min(1)).optional()
}).strict();

const lessonSentenceSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().trim().min(1).optional(),
  words: z.array(lessonWordSchema).optional(),
  grammar: z.array(lessonGrammarSchema).optional(),
  chunks: z.array(lessonChunkSchema).optional()
}).strict();

const lessonImportSchema = z.object({
  language: z.string().trim().min(1),
  baseLanguage: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  source: z.string().trim().optional(),
  level: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  sentences: z.array(lessonSentenceSchema).min(1)
}).strict();

const authorSchema = z.object({
  name: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  url: z.string().trim().url().refine((value) => {
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
  }, "Author URL must use HTTP or HTTPS.").optional()
}).strict();

const packSchema = z.object({
  type: z.literal(FYDOR_PACK_TYPE),
  schemaVersion: z.literal(FYDOR_PACK_SCHEMA_VERSION),
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  author: authorSchema.optional(),
  version: z.string().trim().min(1),
  license: z.string().trim().optional(),
  language: z.string().trim().min(1),
  baseLanguage: z.string().trim().min(1),
  level: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  createdAt: z.string().trim().optional(),
  updatedAt: z.string().trim().optional(),
  unitManifest: z.object({
    schemaVersion: z.literal(1),
    units: z.array(z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      position: z.number().int().nonnegative(),
      lessonIndexes: z.array(z.number().int().nonnegative()).min(1)
    }).strict()).min(1)
  }).strict().optional(),
  grammarGuide: z.object({
    schemaVersion: z.literal(1),
    rules: z.array(z.object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      overview: z.string().trim().min(1),
      situations: z.array(z.object({
        title: z.string().trim().min(1),
        explanation: z.string().trim().min(1),
        unitIndexes: z.array(z.number().int().nonnegative()).min(1)
      }).strict()).min(1),
      contrasts: z.array(z.string().trim().min(1)).optional(),
      commonMistakes: z.array(z.string().trim().min(1)).optional()
    }).strict()).min(1)
  }).strict().optional(),
  lessons: z.array(z.unknown()).min(1)
}).strict();

export function parseFydorPack(source: string): FydorPackValidation {
  let parsed: unknown;
  try {
    parsed = parseStrictJson(source, { maxBytes: 5_000_000, maxDepth: 24 });
  } catch (error) {
    return emptyValidation([error instanceof Error ? error.message : "This is not a readable Fydor Pack."]);
  }

  const packResult = packSchema.safeParse(parsed);
  if (!packResult.success) {
    return emptyValidation(packResult.error.issues.map((issue) => issue.message));
  }

  const lessonErrors: FydorPackValidation["lessonErrors"] = [];
  const lessons: LessonImportInput[] = [];
  const warnings: string[] = [];
  const seenLessonKeys = new Set<string>();

  for (const [index, rawLesson] of packResult.data.lessons.entries()) {
    const result = lessonImportSchema.safeParse(stripNulls(rawLesson));
    const title = getRawTitle(rawLesson, `Lesson ${index + 1}`);
    if (!result.success) {
      lessonErrors.push({
        index,
        title,
        errors: result.error.issues.map((issue) => issue.message)
      });
      continue;
    }

    const lesson = result.data;
    const lessonWarnings = validateLessonContents(lesson);
    if (lessonWarnings.length) {
      lessonErrors.push({ index, title: lesson.title, errors: lessonWarnings });
      continue;
    }

    if (lesson.language !== packResult.data.language || lesson.baseLanguage !== packResult.data.baseLanguage) {
      lessonErrors.push({
        index,
        title: lesson.title,
        errors: [`${lesson.title} uses ${lesson.language} → ${lesson.baseLanguage}, not the pack direction ${packResult.data.language} → ${packResult.data.baseLanguage}.`]
      });
      continue;
    }

    const duplicateKey = lessonKey(lesson);
    if (seenLessonKeys.has(duplicateKey)) {
      warnings.push(`${lesson.title} appears more than once inside this pack.`);
    }
    seenLessonKeys.add(duplicateKey);
    lessons.push(lesson);
  }

  const now = new Date().toISOString();
  const pack: FydorPack = {
    ...packResult.data,
    createdAt: packResult.data.createdAt || now,
    updatedAt: packResult.data.updatedAt || now,
    lessons
  };

  const annexErrors = validatePackAnnexes(pack, packResult.data.unitManifest, packResult.data.grammarGuide);
  if (annexErrors.length) {
    return {
      pack,
      errors: ["One or more pack annexes need attention."],
      warnings,
      lessonErrors,
      lessonCount: lessons.length,
      sentenceCount: countSentences(lessons),
      annexErrors
    };
  }

  return {
    pack,
    errors: lessonErrors.length ? ["One or more lessons in this pack need attention."] : [],
    warnings,
    lessonErrors,
    lessonCount: lessons.length,
    sentenceCount: countSentences(lessons),
    annexErrors: []
  };
}

export function createFydorPack(input: {
  title: string;
  description?: string;
  author?: FydorPackAuthor;
  version: string;
  license?: string;
  tags?: string[];
  lessons: LessonImportInput[];
  unitManifest?: FydorPackUnitManifest;
  grammarGuide?: FydorGrammarGuide;
}): FydorPack {
  const now = new Date().toISOString();
  const firstLesson = input.lessons[0];
  return {
    type: FYDOR_PACK_TYPE,
    schemaVersion: FYDOR_PACK_SCHEMA_VERSION,
    id: stablePackId(input.title, input.author?.name, now),
    title: input.title.trim() || "Untitled Fydor Pack",
    description: emptyToUndefined(input.description),
    author: pruneAuthor(input.author),
    version: input.version.trim() || "1.0.0",
    license: emptyToUndefined(input.license),
    language: firstLesson?.language ?? "zh",
    baseLanguage: firstLesson?.baseLanguage ?? "en",
    level: sharedValue(input.lessons.map((lesson) => lesson.level)),
    tags: uniqueTags(input.tags),
    createdAt: now,
    updatedAt: now,
    unitManifest: input.unitManifest,
    grammarGuide: input.grammarGuide,
    lessons: input.lessons
  };
}

/**
 * Expands pack-level grammar teaching into the existing sentence annotation
 * shape. ruleId is deliberately removed before crossing into the Rust lesson
 * importer, which keeps old lesson JSON and the database contract unchanged.
 */
export function prepareLessonsForImport(pack: FydorPack): LessonImportInput[] {
  const rules = new Map((pack.grammarGuide?.rules ?? []).map((rule) => [rule.id, rule]));
  const lessonUnitPositions = new Map<number, number>();
  pack.unitManifest?.units.forEach((unit) => unit.lessonIndexes.forEach((lessonIndex) => lessonUnitPositions.set(lessonIndex, unit.position)));
  const unitTitles = new Map((pack.unitManifest?.units ?? []).map((unit) => [unit.position, unit.title]));
  return pack.lessons.map((lesson, lessonIndex) => ({
    ...lesson,
    sentences: lesson.sentences.map((sentence) => ({
      ...sentence,
      grammar: sentence.grammar?.map((grammar) => {
        const { ruleId, ...plainGrammar } = grammar;
        const rule = ruleId ? rules.get(ruleId) : undefined;
        if (!rule) return plainGrammar;
        return {
          ...plainGrammar,
          explanation: expandGrammarExplanation(rule, lessonUnitPositions.get(lessonIndex) ?? lessonIndex, unitTitles, grammar.explanation)
        };
      })
    }))
  }));
}

function validatePackAnnexes(
  pack: FydorPack,
  unitManifest: FydorPackUnitManifest | undefined,
  grammarGuide: FydorGrammarGuide | undefined
): string[] {
  const errors: string[] = [];
  if (unitManifest) {
    const ids = new Set<string>();
    const positions = new Set<number>();
    const assigned = new Set<number>();
    unitManifest.units.forEach((unit) => {
      if (ids.has(unit.id)) errors.push(`Unit manifest repeats id "${unit.id}".`);
      ids.add(unit.id);
      if (positions.has(unit.position)) errors.push(`Unit manifest repeats position ${unit.position}.`);
      positions.add(unit.position);
      unit.lessonIndexes.forEach((lessonIndex) => {
        if (lessonIndex >= pack.lessons.length) {
          errors.push(`${unit.title} references missing lesson index ${lessonIndex}.`);
        }
        if (assigned.has(lessonIndex)) errors.push(`Lesson index ${lessonIndex} appears in more than one unit.`);
        assigned.add(lessonIndex);
      });
    });
    if (assigned.size !== pack.lessons.length) errors.push("Unit manifest must assign every lesson exactly once.");
  }

  if (grammarGuide) {
    const ruleIds = new Set<string>();
    const referencedRuleIds = new Set<string>();
    grammarGuide.rules.forEach((rule) => {
      if (ruleIds.has(rule.id)) errors.push(`Grammar guide repeats rule id "${rule.id}".`);
      ruleIds.add(rule.id);
      rule.situations.forEach((situation) => situation.unitIndexes.forEach((unitIndex) => {
        if (unitManifest && !unitManifest.units.some((unit) => unit.position === unitIndex)) {
          errors.push(`Grammar rule "${rule.id}" references missing unit position ${unitIndex}.`);
        } else if (!unitManifest && unitIndex >= pack.lessons.length) {
          errors.push(`Grammar rule "${rule.id}" references missing lesson index ${unitIndex}.`);
        }
      }));
    });
    pack.lessons.forEach((lesson) => lesson.sentences.forEach((sentence) => sentence.grammar?.forEach((grammar) => {
      if (grammar.ruleId && !ruleIds.has(grammar.ruleId)) {
        errors.push(`Grammar annotation references unknown rule "${grammar.ruleId}".`);
      } else if (grammar.ruleId) {
        referencedRuleIds.add(grammar.ruleId);
      }
    })));
    grammarGuide.rules.forEach((rule) => {
      if (!referencedRuleIds.has(rule.id)) errors.push(`Grammar rule "${rule.id}" has no sentence examples.`);
    });
  }
  return errors;
}

function expandGrammarExplanation(
  rule: FydorGrammarGuideRule,
  lessonIndex: number,
  unitTitles: Map<number, string>,
  localExplanation: string | undefined
): string {
  const situations = rule.situations
    .filter((situation) => situation.unitIndexes.includes(lessonIndex))
    .map((situation) => `${situation.title}: ${situation.explanation}`);
  const acrossCourse = rule.situations
    .flatMap((situation) => situation.unitIndexes.map((index) => unitTitles.get(index) ?? `Unit ${index + 1}`))
    .filter((title, index, values) => values.indexOf(title) === index)
    .join(", ");
  const sections = [
    `Rule: ${rule.title}.`,
    `Overview: ${rule.overview}`,
    situations.length ? `Use in this lesson: ${situations.join(" ")}` : undefined,
    acrossCourse ? `Across the course: ${acrossCourse}.` : undefined,
    rule.contrasts?.length ? `Contrast: ${rule.contrasts.join(" ")}` : undefined,
    rule.commonMistakes?.length ? `Common mistakes: ${rule.commonMistakes.join(" ")}` : undefined,
    localExplanation ? `This sentence: ${localExplanation}` : undefined
  ];
  return sections.filter(Boolean).join(" ");
}

export function countSentences(lessons: LessonImportInput[]): number {
  return lessons.reduce((total, lesson) => total + lesson.sentences.length, 0);
}

export function estimatePackSize(pack: FydorPack): string {
  const bytes = new Blob([JSON.stringify(pack, null, 2)]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function slugifyPackTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "fydor-pack";
}

export function lessonKey(lesson: Pick<LessonImportInput, "title" | "language" | "baseLanguage">): string {
  return `${lesson.language}:${lesson.baseLanguage}:${lesson.title.trim().toLowerCase()}`;
}

function validateLessonContents(lesson: LessonImportInput): string[] {
  const errors: string[] = [];
  const seenSentences = new Set<string>();

  lesson.sentences.forEach((sentence, index) => {
    const normalized = sentence.text.trim().toLocaleLowerCase();
    if (seenSentences.has(normalized)) {
      errors.push(`Duplicate sentence text at sentence ${index + 1}.`);
    }
    seenSentences.add(normalized);

    for (const word of sentence.words ?? []) {
      if (!containsSurface(sentence.text, word.surface)) {
        errors.push(`Sentence ${index + 1}: word surface "${word.surface}" does not appear in the sentence.`);
      }
    }
    for (const grammar of sentence.grammar ?? []) {
      if (grammar.surface && !containsSurface(sentence.text, grammar.surface)) {
        errors.push(`Sentence ${index + 1}: grammar surface "${grammar.surface}" does not appear in the sentence.`);
      }
    }
    for (const chunk of sentence.chunks ?? []) {
      if (!containsSurface(sentence.text, chunk.surface)) {
        errors.push(`Sentence ${index + 1}: chunk surface "${chunk.surface}" does not appear in the sentence.`);
      }
    }
  });

  return errors;
}

function canonicalizePack(pack: FydorPack) {
  return {
    language: pack.language,
    baseLanguage: pack.baseLanguage,
    grammarGuide: pack.grammarGuide,
    lessons: pack.lessons.map((lesson) => ({
      language: lesson.language,
      baseLanguage: lesson.baseLanguage,
      sentences: lesson.sentences.map((sentence) => {
        const output: Record<string, unknown> = { text: sentence.text, translation: sentence.translation };
        for (const key of ["words", "grammar", "chunks"] as const) {
          if (sentence[key]?.length) output[key] = sentence[key];
        }
        return output;
      })
    }))
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

function containsSurface(sentenceText: string, surface: string): boolean {
  return sentenceText.toLocaleLowerCase().includes(surface.toLocaleLowerCase());
}

function emptyValidation(errors: string[]): FydorPackValidation {
  return {
    errors,
    warnings: [],
    lessonErrors: [],
    annexErrors: [],
    lessonCount: 0,
    sentenceCount: 0
  };
}

function getRawTitle(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || !("title" in value)) return fallback;
  const title = (value as { title?: unknown }).title;
  return typeof title === "string" && title.trim() ? title : fallback;
}

function stablePackId(title: string, authorName: string | undefined, createdAt: string): string {
  const seed = `${title}-${authorName ?? "fydor"}-${createdAt}`;
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || `pack-${Date.now()}`;
}

function pruneAuthor(author: FydorPackAuthor | undefined): FydorPackAuthor | undefined {
  if (!author) return undefined;
  const next = {
    name: emptyToUndefined(author.name),
    organization: emptyToUndefined(author.organization),
    url: emptyToUndefined(author.url)
  };
  return next.name || next.organization || next.url ? next : undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function uniqueTags(tags: string[] | undefined): string[] {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
}

function stripNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNulls);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripNulls(v);
      if (stripped !== undefined) result[k] = stripped;
    }
    return result;
  }
  return value;
}

function sharedValue(values: Array<string | undefined>): string | undefined {
  const present = values.map((value) => value?.trim()).filter(Boolean) as string[];
  if (!present.length) return undefined;
  return present.every((value) => value === present[0]) ? present[0] : undefined;
}
