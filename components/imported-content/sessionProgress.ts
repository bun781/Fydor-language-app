"use client";

const STORAGE_PREFIX = "fydor.study-progress";

export function readSessionProgress<T>(key: string, validate: (value: unknown) => T | null): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(formatKey(key));
    if (!raw) return null;
    return validate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeSessionProgress<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(formatKey(key), JSON.stringify(value));
  } catch {
    // Keep study sessions usable if browser storage is unavailable.
  }
}

function formatKey(key: string) {
  return `${STORAGE_PREFIX}.${key}`;
}
