import { fydorWebUrl } from "@/lib/webOrigin";
import type { FydorPack } from "@/lib/fydor-pack";
import type { LessonImportInput } from "@/lib/language/types";

export interface PublishedLessonSummary {
  id: string;
  title: string;
  description: string;
  targetLanguage: string;
  baseLanguage: string;
  level: string;
  tags: string[];
  sentenceCount: number;
  schemaVersion: number;
  lessonVersion: string;
  publishedAt: string;
  updatedAt: string;
  checksum: string;
  license: string;
  compatibility: string;
}

export interface PublishedLessonEnvelope {
  manifest: PublishedLessonSummary;
  lesson: LessonImportInput & { schemaVersion: 1 };
  checksum: string;
}

export interface PublishedLessonQuery {
  q?: string;
  language?: string;
  baseLanguage?: string;
  level?: string;
  tag?: string;
  sort?: "newest" | "oldest" | "title";
  page?: number;
  pageSize?: number;
}

export interface PublishedPackResult {
  pack: {
    id: string;
    title: string;
    version: string;
    language: string;
    baseLanguage: string;
    lessonCount: number;
    sentenceCount: number;
  };
  bucket: string;
  path: string;
  publicUrl: string;
  checksum: string;
  byteLength: number;
}

export async function listPublishedLessons(query: PublishedLessonQuery = {}): Promise<{ lessons: PublishedLessonSummary[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return fetchJson(fydorWebUrl(`/api/library?${params}`));
}

export async function downloadPublishedLesson(id: string): Promise<PublishedLessonEnvelope> {
  if (!/^lesson-[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid published lesson identifier.");
  return fetchJson(fydorWebUrl(`/api/library?id=${encodeURIComponent(id)}&download=1`));
}

export async function publishFydorPack(pack: FydorPack): Promise<PublishedPackResult> {
  return fetchJson(fydorWebUrl("/api/packs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pack })
  });
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init.headers ?? {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) throw new Error((data as { error?: { message?: string } } | null)?.error?.message || `Library request failed (${response.status}).`);
  return data as T;
}
