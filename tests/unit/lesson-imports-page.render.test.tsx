// @vitest-environment jsdom
// Rendered coverage for the lesson import workflow: validate, save, and the
// error path where the Rust command rejects.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LessonImportsPage from "@/components/admin-imports/LessonImportsPage";
import type { LessonImportPreviewResult, LessonImportSummary } from "@/lib/language/types";

vi.mock("@/lib/desktopApi", () => ({
  getLessons: vi.fn(() => Promise.resolve([])),
  previewLessonImport: vi.fn(),
  importLesson: vi.fn(),
  updateLesson: vi.fn(),
  deleteLesson: vi.fn(),
  exportLesson: vi.fn(),
  getLessonCached: vi.fn()
}));

import { getLessons, importLesson, previewLessonImport } from "@/lib/desktopApi";

const mockedPreview = vi.mocked(previewLessonImport);
const mockedImport = vi.mocked(importLesson);
const mockedGetLessons = vi.mocked(getLessons);

const previewResult: LessonImportPreviewResult = {
  lesson: {
    language: "ko",
    baseLanguage: "en",
    title: "New lesson",
    description: "",
    level: "beginner",
    tags: []
  },
  sentenceCount: 1,
  duplicateImport: false,
  validationErrors: [],
  sentences: [],
  vocabulary: [],
  grammar: [],
  chunks: []
};

const importSummary: LessonImportSummary = {
  lessonCreated: true,
  lessonUpdated: false,
  sentencesImported: 1,
  sentencesSkipped: 0,
  vocabularyCreated: 0,
  vocabularyReused: 0,
  grammarCreated: 0,
  grammarReused: 0,
  chunksCreated: 0,
  chunksReused: 0,
  linksCreated: 0,
  errors: []
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonImportsPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockedGetLessons.mockResolvedValue([]);
  mockedPreview.mockResolvedValue(previewResult);
  mockedImport.mockResolvedValue(importSummary);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LessonImportsPage import flow", () => {
  it("validates the builder lesson through preview_lesson_import", async () => {
    renderPage();
    await waitFor(() => expect(mockedGetLessons).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Check/ }));

    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(1));
    const [source] = mockedPreview.mock.calls[0];
    expect(JSON.parse(source).title).toBe("New lesson");
    await waitFor(() => expect(screen.getByText("Validation passed.")).toBeTruthy());
  });

  it("saves a new lesson and reports the import summary", async () => {
    renderPage();
    await waitFor(() => expect(mockedGetLessons).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => expect(mockedImport).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("Lesson saved.")).toBeTruthy());
    // Lesson list is refreshed after a successful import.
    expect(mockedGetLessons.mock.calls.length).toBeGreaterThan(1);
  });

  it("surfaces the Rust error string when the import command fails", async () => {
    mockedImport.mockRejectedValue("Sentence 2 is missing a translation.");
    renderPage();
    await waitFor(() => expect(mockedGetLessons).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Sentence 2 is missing a translation.")
    );
  });

  it("can edit lesson content in the builder before saving", async () => {
    renderPage();
    await waitFor(() => expect(mockedGetLessons).toHaveBeenCalled());

    const [titleInput] = screen.getAllByDisplayValue("New lesson");
    fireEvent.change(titleInput, { target: { value: "Greetings 101" } });

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    await waitFor(() => expect(mockedImport).toHaveBeenCalledTimes(1));
    const [source] = mockedImport.mock.calls[0];
    expect(JSON.parse(source).title).toBe("Greetings 101");
  });
});
