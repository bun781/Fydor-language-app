import { fydorWebUrl } from "@/lib/webOrigin";
import { computeFydorPackChecksum, parseFydorPack, type FydorPack } from "@/lib/fydor-pack";

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

export async function listPublishedLessons(query: PublishedLessonQuery = {}): Promise<{ lessons: PublishedLessonSummary[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return fetchJson(fydorWebUrl(`/api/library?${params}`));
}

export async function downloadPublishedLesson(id: string, expectedChecksum: string): Promise<FydorPack> {
  if (!id.trim() || !expectedChecksum.match(/^[a-f0-9]{64}$/i)) throw new Error("Invalid published lesson metadata.");
  const response = await fetch(fydorWebUrl(`/api/library?id=${encodeURIComponent(id)}&download=1`), {
    headers: { Accept: "application/vnd.fydor-pack+json, application/json" },
    cache: "no-store"
  });
  const source = await response.text();
  if (!response.ok) throw new Error(readError(source, response.status));

  const validation = parseFydorPack(source);
  if (!validation.pack || validation.errors.length || validation.lessonErrors.length) {
    throw new Error(validation.errors[0] || validation.lessonErrors[0]?.errors[0] || "Downloaded package is invalid.");
  }
  const checksum = await computeFydorPackChecksum(validation.pack);
  if (checksum !== expectedChecksum.toLowerCase()) throw new Error("The downloaded package failed its integrity check.");
  return validation.pack;
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

function readError(source: string, status: number): string {
  try {
    const value = JSON.parse(source) as { error?: { message?: string } };
    return value.error?.message || `Library request failed (${status}).`;
  } catch {
    return `Library request failed (${status}).`;
  }
}
