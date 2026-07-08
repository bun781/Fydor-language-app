// Single localStorage/sessionStorage access point. Every persisted value is read
// through a zod schema so corrupt or outdated payloads degrade to null instead of
// crashing the UI. Do not read window.localStorage directly elsewhere.
import type { z } from "zod";

const STORAGE_PREFIX = "fydor.study-progress";

type Schema<T> = z.ZodType<T, z.ZodTypeDef, unknown>;

export function readSessionProgress<T>(key: string, schema: Schema<T>): T | null {
  const value = readLocal(formatKey(key), schema);
  // Refresh localStorage in case the value was only recoverable from sessionStorage.
  if (value !== null) writeSessionProgress(key, value);
  return value;
}

export function writeSessionProgress<T>(key: string, value: T) {
  writeLocal(formatKey(key), value);
}

export function clearSessionProgress(key: string) {
  clearLocal(formatKey(key));
}

// Raw-key variants for values that predate the study-progress prefix
// (saved quiz results, installed exchange packs, lesson import drafts).
export function readLocal<T>(storageKey: string, schema: Schema<T>): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeLocal<T>(storageKey: string, value: T) {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(value);
  try {
    window.localStorage.setItem(storageKey, serialized);
  } catch {
    try {
      window.sessionStorage.setItem(storageKey, serialized);
    } catch {
      // Keep sessions usable if browser storage is unavailable.
    }
  }
}

export function clearLocal(storageKey: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Clearing is best-effort; callers still reset in-memory state.
  }
}

function formatKey(key: string) {
  return `${STORAGE_PREFIX}.${key}`;
}
