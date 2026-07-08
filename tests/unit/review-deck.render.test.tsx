// @vitest-environment jsdom
// Rendered coverage for the riskiest review flows: keyboard grading, session
// restore after a reload, rollback on failed persistence, and the empty state.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import type { ReviewSentence } from "@/lib/review/types";

vi.mock("@/lib/desktopApi", () => ({
  getReviewProgress: vi.fn(() =>
    Promise.resolve({
      dailyActivity: [],
      itemStats: { total: 0, graded: 0, mastered: 0 },
      sentenceStats: { total: 2, graded: 0, mastered: 0 }
    })
  ),
  updateReviewItem: vi.fn(),
  updateItemReview: vi.fn()
}));

import { updateReviewItem } from "@/lib/desktopApi";

const mockedUpdateReviewItem = vi.mocked(updateReviewItem);

function sentence(id: string, text: string): ReviewSentence {
  return {
    id,
    lessonId: "lesson-1",
    language: "ko",
    text,
    translation: `${text} (translation)`,
    reviewState: "unknown",
    reviewStreak: 0,
    reviewedAt: null,
    dueAt: "2026-07-01T10:00:00.000Z",
    lastReviewedAt: null,
    repetitions: 0,
    lapses: 0,
    difficulty: 0.3,
    stability: 0,
    recallMode: "full_support",
    schedulerEngine: "fixed-interval"
  };
}

function savedRow(graded: ReviewSentence): ReviewSentence {
  return {
    ...graded,
    reviewState: "remembered",
    reviewStreak: 1,
    repetitions: 1,
    dueAt: "2026-07-12T10:00:00.000Z",
    schedulerEngine: "fsrs"
  };
}

const SENTENCES = [sentence("s1", "안녕하세요."), sentence("s2", "감사합니다.")];

function renderDeck() {
  return render(<ReviewDeck sentences={SENTENCES} onResetProgress={() => {}} />);
}

function startMixedReview() {
  fireEvent.click(screen.getByRole("button", { name: "Start Mixed Review" }));
}

function revealCurrentCard() {
  fireEvent.keyDown(window, { key: " " });
  fireEvent.keyUp(window, { key: " " });
}

function shownSentence(): string {
  return document.querySelector(".review-sentence")?.textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockedUpdateReviewItem.mockReset();
  mockedUpdateReviewItem.mockImplementation((id) =>
    Promise.resolve(savedRow(SENTENCES.find((item) => item.id === id) ?? SENTENCES[0]))
  );
});

afterEach(() => {
  cleanup();
});

describe("ReviewDeck keyboard grading", () => {
  it("reveals with Space and grades with the 3 key, then advances", async () => {
    renderDeck();
    startMixedReview();

    const firstText = shownSentence();
    revealCurrentCard();
    fireEvent.keyDown(window, { key: "3" });

    await waitFor(() => expect(mockedUpdateReviewItem).toHaveBeenCalledTimes(1));
    const [gradedId, decision] = mockedUpdateReviewItem.mock.calls[0];
    expect(decision).toBe("remembered");
    expect(SENTENCES.some((item) => item.id === gradedId)).toBe(true);

    // The next card is shown.
    await waitFor(() => {
      expect(shownSentence()).not.toBe(firstText);
    });
  });

  it("does not grade before the card is revealed", async () => {
    renderDeck();
    startMixedReview();

    fireEvent.keyDown(window, { key: "3" });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedUpdateReviewItem).not.toHaveBeenCalled();
  });

  it("finishes the session after every card is graded", async () => {
    renderDeck();
    startMixedReview();

    for (let i = 0; i < SENTENCES.length; i += 1) {
      revealCurrentCard();
      fireEvent.keyDown(window, { key: "3" });
      await waitFor(() => expect(mockedUpdateReviewItem).toHaveBeenCalledTimes(i + 1));
    }

    await waitFor(() => expect(screen.getByText(/Mixed review complete/)).toBeTruthy());
  });
});

describe("ReviewDeck session restore", () => {
  it("resumes a mid-session queue at the same position after a remount", async () => {
    const first = renderDeck();
    startMixedReview();

    const firstText = shownSentence();
    revealCurrentCard();
    fireEvent.keyDown(window, { key: "3" });
    await waitFor(() => expect(mockedUpdateReviewItem).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(shownSentence()).not.toBe(firstText));
    const secondText = shownSentence();

    first.unmount();
    renderDeck();

    // Restored straight into the session on the ungraded card, not the start menu.
    expect(screen.queryByRole("button", { name: "Start Mixed Review" })).toBeNull();
    expect(shownSentence()).toBe(secondText);
  });
});

describe("ReviewDeck failed persistence", () => {
  it("rolls the card back and surfaces the Rust error string", async () => {
    // Tauri command failures reject with a plain string, not an Error.
    mockedUpdateReviewItem.mockImplementation(() => Promise.reject("database is locked"));
    renderDeck();
    startMixedReview();

    const firstText = shownSentence();
    revealCurrentCard();
    fireEvent.keyDown(window, { key: "3" });

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("database is locked"));
    // Rolled back: the same card is still presented for a retry.
    expect(shownSentence()).toBe(firstText);
  });
});

describe("ReviewDeck empty state", () => {
  it("explains what to do when no lessons are imported", () => {
    render(<ReviewDeck sentences={[]} />);
    expect(screen.getByText("No sentences to review yet")).toBeTruthy();
  });
});
