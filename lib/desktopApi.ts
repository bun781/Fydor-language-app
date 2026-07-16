// Single point of contact between the frontend and Tauri Rust commands. All invoke() calls live here. Command name strings must match #[tauri::command] names in src-tauri/src/.
import { invoke } from "@tauri-apps/api/core";
import type { StudyLesson, StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";
import { resolveLessonAnnotations } from "@/lib/imported-content/annotation-resolution";
import type { LessonImportInput, LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";
import type { ReadingInputs } from "@/lib/reading/analyzer";
import type { ReviewDecision, ReviewItemTarget, ReviewProgressSnapshot, ReviewResetScope, ReviewSentence } from "@/lib/review/types";
export interface LanguagePair { id: string; targetLanguage: string; baseLanguage: string; }
export async function getLanguagePairs(): Promise<LanguagePair[]> { return invoke("get_language_pairs"); }
export async function getActiveLanguagePair(): Promise<string> { return invoke("get_active_language_pair"); }
export async function setActiveLanguagePair(languagePairId: string): Promise<void> { return invoke("set_active_language_pair", { languagePairId }); }

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

// In-memory cache for full lesson bodies. Lesson content only changes through the
// mutation commands below, which clear it — review grading never alters lesson content.
const lessonCache = new Map<string, StudyLesson>();

export async function getLessonCached(lessonId: string): Promise<StudyLesson | null> {
  const cached = lessonCache.get(lessonId);
  if (cached) return cached;
  const lesson = await getLesson(lessonId);
  if (!lesson) return null;
  lessonCache.set(lessonId, lesson);
  // Re-resolve all loaded lessons as the local cache grows. The resolver receives
  // a batch and includes the full directional pair in every eligibility check.
  const cachedLessons = [...lessonCache.values()];
  for (const cachedLesson of cachedLessons) {
    lessonCache.set(cachedLesson.id, resolveLessonAnnotations(cachedLesson, cachedLessons));
  }
  return lessonCache.get(lessonId) ?? null;
}

function invalidateLessonCache() {
  lessonCache.clear();
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
