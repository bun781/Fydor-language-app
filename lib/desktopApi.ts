// Single point of contact between the frontend and Tauri Rust commands. All invoke() calls live here. Command name strings must match #[tauri::command] names in src-tauri/src/.
import { invoke } from "@tauri-apps/api/core";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportInput, LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";
import type { ReadingInputs } from "@/lib/reading/analyzer";
import type { ReviewDecision, ReviewItemTarget, ReviewProgressSnapshot, ReviewResetScope, ReviewSentence } from "@/lib/review/types";

export async function getLessons(): Promise<StudyLessonMeta[]> {
  return invoke("get_lessons");
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
  if (lesson) lessonCache.set(lessonId, lesson);
  return lesson;
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

export interface PublishedLessonInstallResult {
  status: "installed" | "updated" | "already_installed";
  lessonId: string;
  lessonVersion: string;
  progressPreserved: boolean;
  warning?: string;
  summary: LessonImportSummary;
}

export async function installPublishedLesson(input: {
  stableLessonId: string;
  lessonVersion: string;
  checksum: string;
  source: string;
}): Promise<PublishedLessonInstallResult> {
  invalidateLessonCache();
  return invoke("install_published_lesson", input);
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
