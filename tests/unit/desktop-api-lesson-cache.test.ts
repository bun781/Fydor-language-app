import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const lesson = (id: string) => ({
  id,
  language: "ko",
  baseLanguage: "en",
  title: id,
  description: null,
  source: null,
  level: null,
  tags: [],
  sentences: []
});

describe("cached lesson loading", () => {
  beforeEach(() => {
    vi.resetModules();
    invoke.mockReset();
    invoke.mockImplementation((command: string, args?: { lessonId?: string }) => {
      if (command === "get_lesson") return Promise.resolve(args?.lessonId ? lesson(args.lessonId) : null);
      if (command === "update_lesson") return Promise.resolve({});
      return Promise.resolve(undefined);
    });
  });

  it("deduplicates concurrent bulk loads and reuses their resolved views", async () => {
    const { getLessonCached, getLessonsCached } = await import("@/lib/desktopApi");

    const loaded = await getLessonsCached(["lesson-a", "lesson-b", "lesson-a"]);

    expect(loaded.map((item) => item.id)).toEqual(["lesson-a", "lesson-b"]);
    expect(invoke).toHaveBeenCalledTimes(2);
    await getLessonCached("lesson-a");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("invalidates raw and resolved lesson views after a content mutation", async () => {
    const { getLessonCached, updateLesson } = await import("@/lib/desktopApi");

    await getLessonCached("lesson-a");
    await updateLesson("lesson-a", "{}");
    await getLessonCached("lesson-a");

    expect(invoke.mock.calls.filter(([command]) => command === "get_lesson")).toHaveLength(2);
  });
});
