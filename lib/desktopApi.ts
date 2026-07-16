// Single point of contact between the frontend and Tauri Rust commands. All invoke() calls live here. Command name strings must match #[tauri::command] names in src-tauri/src/.
import { invoke } from "@tauri-apps/api/core";
import type { StudyLesson, StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";
import { resolveLessonAnnotations } from "@/lib/imported-content/annotation-resolution";
import type { LessonImportInput, LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";
import type { ReadingInputs } from "@/lib/reading/analyzer";
import type { ReviewDecision, ReviewItemTarget, ReviewProgressSnapshot, ReviewResetScope, ReviewSentence } from "@/lib/review/types";
export interface LanguagePair { id: string; targetLanguage: string; baseLanguage: string; }
export interface CourseInput {
  languagePairId: string;
  title: string;
  description?: string | null;
}

export interface Course {
  id: string;
  languagePairId: string;
  title: string;
  description?: string | null;
}

export interface CourseUnit {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  position: number;
}

export interface CollectionInput {
  languagePairId: string;
  title: string;
  kind: "manual" | "smart";
  queryJson?: string | null;
}

export interface Collection extends CollectionInput { id: string; }

export async function getLanguagePairs(): Promise<LanguagePair[]> { return invoke("get_language_pairs"); }
export async function getActiveLanguagePair(): Promise<string> { return invoke("get_active_language_pair"); }
export async function setActiveLanguagePair(languagePairId: string): Promise<void> { return invoke("set_active_language_pair", { languagePairId }); }
export async function createCourse(input: CourseInput): Promise<Course> { return invoke("create_course", { input }); }
export async function createCourseUnit(courseId: string, title: string, description?: string | null): Promise<CourseUnit> {
  return invoke("create_course_unit", { courseId, title, description: description ?? null });
}
export async function addLessonToUnit(unitId: string, lessonId: string): Promise<void> { return invoke("add_lesson_to_unit", { unitId, lessonId }); }
export async function reorderUnitLessons(unitId: string, lessonIds: string[]): Promise<void> { return invoke("reorder_unit_lessons", { unitId, lessonIds }); }
export async function createCollection(input: CollectionInput): Promise<Collection> { return invoke("create_collection", { input }); }

export async function getLessons(): Promise<StudyLessonMeta[]> {
  return invoke("get_lessons");
}

export interface PackInput {
  stableId?: string;
  title: string;
  description?: string;
  authorName?: string;
  organization?: string;
  authorUrl?: string;
  language?: string;
  baseLanguage?: string;
  level?: string;
  tags?: string[];
  version?: string;
  license?: string;
  sourceType?: string;
}

export async function getPacks(): Promise<StudyPackMeta[]> {
  return invoke("get_packs");
}

export async function upsertPack(input: PackInput): Promise<StudyPackMeta> {
  return invoke("upsert_pack", { input });
}

export async function updatePack(packId: string, title: string, description: string, archived: boolean): Promise<void> {
  return invoke("update_pack", { packId, title, description, archived });
}

export async function moveLessonsToPack(lessonIds: string[], packId: string): Promise<void> {
  return invoke("move_lessons_to_pack", { lessonIds, packId });
}

export async function deletePack(packId: string): Promise<void> {
  return invoke("delete_pack", { packId });
}

async function getLesson(lessonId: string): Promise<StudyLesson | null> {
  return invoke("get_lesson", { lessonId });
}

// Keep imported lesson bodies separate from their derived annotation view. The derived
// view changes whenever another lesson in the same pair becomes available, while the
// imported body does not. Previously every cache miss re-resolved every cached lesson;
// loading N lessons therefore repeated N full annotation passes. A cache miss now only
// invalidates derived views, and bulk callers resolve each requested lesson once.
const lessonSourceCache = new Map<string, StudyLesson>();
const resolvedLessonCache = new Map<string, StudyLesson>();
const pendingLessonLoads = new Map<string, Promise<StudyLesson | null>>();

export async function getLessonCached(lessonId: string): Promise<StudyLesson | null> {
  await loadLessonSource(lessonId);
  return resolveCachedLesson(lessonId);
}

/**
 * Fetches lesson bodies concurrently, then resolves annotations from one stable source
 * snapshot. Use this for list screens and prefetching; it avoids the repeated complete
 * cache re-resolution that individual concurrent calls used to trigger.
 */
export async function getLessonsCached(lessonIds: readonly string[]): Promise<StudyLesson[]> {
  const ids = [...new Set(lessonIds)];
  const before = lessonSourceCache.size;
  await Promise.all(ids.map(loadLessonSource));
  if (lessonSourceCache.size !== before) resolvedLessonCache.clear();
  return ids.flatMap((lessonId) => {
    const lesson = resolveCachedLesson(lessonId);
    return lesson ? [lesson] : [];
  });
}

function resolveCachedLesson(lessonId: string): StudyLesson | null {
  const source = lessonSourceCache.get(lessonId);
  if (!source) return null;
  const resolved = resolvedLessonCache.get(lessonId);
  if (resolved) return resolved;

  const next = resolveLessonAnnotations(source, [...lessonSourceCache.values()]);
  resolvedLessonCache.set(lessonId, next);
  return next;
}

async function loadLessonSource(lessonId: string): Promise<StudyLesson | null> {
  const cached = lessonSourceCache.get(lessonId);
  if (cached) return cached;
  const pending = pendingLessonLoads.get(lessonId);
  if (pending) return pending;

  const request = getLesson(lessonId)
    .then((lesson) => {
      if (lesson) {
        lessonSourceCache.set(lessonId, lesson);
        resolvedLessonCache.clear();
      }
      return lesson;
    })
    .finally(() => pendingLessonLoads.delete(lessonId));
  pendingLessonLoads.set(lessonId, request);
  return request;
}

function invalidateLessonCache() {
  lessonSourceCache.clear();
  resolvedLessonCache.clear();
  pendingLessonLoads.clear();
}

export async function exportLesson(lessonId: string): Promise<LessonImportInput> {
  return invoke("export_lesson", { lessonId });
}

export async function updateLesson(lessonId: string, source: string): Promise<LessonImportSummary> {
  invalidateLessonCache();
  return invoke("update_lesson", { lessonId, source });
}

export async function deleteLesson(lessonId: string): Promise<void> {
  invalidateLessonCache();
  return invoke("delete_lesson", { lessonId });
}

export async function previewLessonImport(source: string, lessonId?: string): Promise<LessonImportPreviewResult> {
  return invoke("preview_lesson_import", { source, ...(lessonId ? { lessonId } : {}) });
}

export async function importLesson(source: string, lessonId?: string): Promise<LessonImportSummary> {
  invalidateLessonCache();
  return invoke("import_lesson", { source, ...(lessonId ? { lessonId } : {}) });
}

export async function getReviewQueue(): Promise<ReviewSentence[]> {
  return invoke("get_review_queue");
}

export async function updateReviewItem(sentenceId: string, decision: ReviewDecision): Promise<ReviewSentence> {
  return invoke("update_review_item", { sentenceId, decision });
}

export async function resetReviewProgress(scope: ReviewResetScope): Promise<void> {
  return invoke("reset_review_progress", { scope });
}

export async function getItemReviewTargets(): Promise<ReviewItemTarget[]> {
  return invoke("get_item_review_targets");
}

export async function updateItemReview(learningItemId: string, decision: ReviewDecision): Promise<ReviewItemTarget> {
  return invoke("update_item_review", { learningItemId, decision });
}

export async function getReviewProgress(): Promise<ReviewProgressSnapshot> {
  return invoke("get_review_progress");
}

export async function getReadingInputs(): Promise<ReadingInputs> {
  return invoke("get_reading_inputs");
}

export async function saveFydorPack(suggestedName: string, source: string): Promise<string | null> {
  return invoke("save_fydor_pack", { suggestedName, source });
}

export async function openGenerationDestination(
  destination: "chatgpt" | "claude" | "contributor",
  sourceLessonId?: string
): Promise<void> {
  return invoke("open_generation_destination", { destination, ...(sourceLessonId ? { sourceLessonId } : {}) });
}

export async function openCommunityWorkspace(
  destination: "contributor" | "moderate" | "admin",
  sourceLessonId?: string
): Promise<void> {
  return invoke("open_community_workspace", { destination, ...(sourceLessonId ? { sourceLessonId } : {}) });
}
