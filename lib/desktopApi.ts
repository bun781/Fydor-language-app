"use client";

import { invoke } from "@tauri-apps/api/core";
import type { StudyLesson, StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";
import type { ReviewDecision, ReviewSentence } from "@/lib/review/types";

export async function getLessons(): Promise<StudyLessonMeta[]> {
  return invoke("get_lessons");
}

export async function getLesson(lessonId: string): Promise<StudyLesson | null> {
  return invoke("get_lesson", { lessonId });
}

export async function previewLessonImport(source: string): Promise<LessonImportPreviewResult> {
  return invoke("preview_lesson_import", { source });
}

export async function importLesson(source: string): Promise<LessonImportSummary> {
  return invoke("import_lesson", { source });
}

export async function getReviewQueue(): Promise<ReviewSentence[]> {
  return invoke("get_review_queue");
}

export async function updateReviewItem(sentenceId: string, decision: ReviewDecision): Promise<ReviewSentence> {
  return invoke("update_review_item", { sentenceId, decision });
}

export async function saveUserSettings(settings: Record<string, unknown>): Promise<void> {
  await invoke("save_user_settings", { settings });
}
