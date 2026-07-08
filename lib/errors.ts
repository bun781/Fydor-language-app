/**
 * Message for a caught unknown, with a user-facing fallback. Tauri command failures
 * arrive as plain strings; treat those as messages too instead of dropping them.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
