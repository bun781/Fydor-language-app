import { describe, expect, it } from "vitest";
import {
  buildInterleavedReviewQueue,
  buildTargetedReviewQueue,
  itemTargetToQueueEntry,
  makeReviewTargetKey,
  parseReviewTargetKey
} from "@/lib/review/queue";
import { applyReviewDecision } from "@/lib/review/scheduler";
import type { ReviewItemTarget, ReviewSentence } from "@/lib/review/types";

const NOW = new Date("2026-07-08T10:00:00.000Z");

function sentence(id: string, overrides: Partial<ReviewSentence> = {}): ReviewSentence {
  return {
    id,
    language: "ko",
    text: `Sentence ${id}`,
    translation: `Translation ${id}`,
    reviewState: "unknown",
    reviewStreak: 0,
    reviewedAt: null,
    repetitions: 0,
    dueAt: NOW.toISOString(),
    lessonId: "lesson-1",
    ...overrides
  };
}

function itemTarget(id: string, overrides: Partial<ReviewItemTarget> = {}): ReviewItemTarget {
  return {
    id,
    itemType: "word",
    canonicalKey: `ko:${id}`,
    displayText: id,
    meaning: null,
    explanation: null,
    language: "ko",
    dueAt: NOW.toISOString(),
    lastReviewedAt: null,
    repetitions: 0,
    lapses: 0,
    difficulty: 0.3,
    stability: 0,
    schedulerEngine: "fixed-interval",
    exampleSentenceId: `sentence-for-${id}`,
    exampleText: `Example for ${id}`,
    exampleTranslation: `Example translation for ${id}`,
    exampleSurfaceText: id,
    exampleCount: 1,
    ...overrides
  };
}

describe("review target keys", () => {
  it("round-trips sentence and item keys", () => {
    expect(parseReviewTargetKey(makeReviewTargetKey("sentence", "s1"))).toEqual({ kind: "sentence", id: "s1" });
    expect(parseReviewTargetKey(makeReviewTargetKey("item", "i1"))).toEqual({ kind: "item", id: "i1" });
  });

  it("rejects malformed keys", () => {
    expect(parseReviewTargetKey("s1")).toBeNull();
    expect(parseReviewTargetKey("lesson:l1")).toBeNull();
    expect(parseReviewTargetKey("item:")).toBeNull();
  });
});

describe("targeted review queue", () => {
  it("is byte-identical to the sentence queue when no items are passed", () => {
    const sentences = [
      sentence("a", { repetitions: 2, dueAt: "2026-07-07T10:00:00.000Z", reviewState: "remembered" }),
      sentence("b"),
      sentence("c", { repetitions: 1, dueAt: "2026-07-09T10:00:00.000Z", reviewState: "remembered" })
    ];

    const plain = buildInterleavedReviewQueue(sentences, { seed: 11, now: NOW });
    const targeted = buildTargetedReviewQueue(sentences, [], { seed: 11, now: NOW });

    expect(targeted).toEqual(plain);
  });

  it("mixes item targets into the queue alongside raw sentence ids", () => {
    const sentences = [sentence("a"), sentence("b")];
    const items = [itemTarget("i1"), itemTarget("i2", { repetitions: 3, dueAt: "2026-07-07T10:00:00.000Z" })];

    const queue = buildTargetedReviewQueue(sentences, items, { seed: 5, now: NOW, filter: "all" });

    expect(queue).toHaveLength(4);
    expect(queue).toContain("a");
    expect(queue).toContain("b");
    expect(queue).toContain("item:i1");
    expect(queue).toContain("item:i2");
  });

  it("never emits duplicate target keys", () => {
    const sentences = [sentence("a"), sentence("a"), sentence("b")];
    const items = [itemTarget("i1"), itemTarget("i1")];

    const queue = buildTargetedReviewQueue(sentences, items, { seed: 3, now: NOW, filter: "all" });

    expect(new Set(queue).size).toBe(queue.length);
  });

  it("treats a due reviewed item as due and an ungraded item as new", () => {
    const dueItem = itemTarget("due-item", { repetitions: 2, dueAt: "2026-07-07T10:00:00.000Z" });
    const newItem = itemTarget("new-item");
    const futureItem = itemTarget("future-item", { repetitions: 2, dueAt: "2026-07-20T10:00:00.000Z" });

    const dueOnly = buildTargetedReviewQueue([], [dueItem, newItem, futureItem], { seed: 1, now: NOW, filter: "due" });
    const newOnly = buildTargetedReviewQueue([], [dueItem, newItem, futureItem], { seed: 1, now: NOW, filter: "new" });

    expect(dueOnly).toEqual(["item:due-item"]);
    expect(newOnly).toEqual(["item:new-item"]);
  });

  it("is deterministic for a fixed seed", () => {
    const sentences = [sentence("a"), sentence("b"), sentence("c")];
    const items = [itemTarget("i1"), itemTarget("i2")];

    const first = buildTargetedReviewQueue(sentences, items, { seed: 42, now: NOW });
    const second = buildTargetedReviewQueue(sentences, items, { seed: 42, now: NOW });

    expect(first).toEqual(second);
  });
});

// The daily new-card cap bounds how many never-graded cards can enter a session. It
// applies to "mixed" and "new" queues; "all" is a full browse and stays uncapped.
describe("daily new-card cap", () => {
  // 8 due cards → the uncapped mixed fresh target is ceil(8 * 0.3) = 3.
  const dueSentences = Array.from({ length: 8 }, (_, index) =>
    sentence(`due-${index + 1}`, { repetitions: 2, dueAt: "2026-07-07T10:00:00.000Z", reviewState: "remembered" })
  );
  const freshItems = ["i1", "i2", "i3", "i4", "i5"].map((id) => itemTarget(id));

  it("caps fresh cards in new-only sessions", () => {
    const queue = buildTargetedReviewQueue([], freshItems, { seed: 1, now: NOW, filter: "new", newLimit: 2 });
    expect(queue).toHaveLength(2);
  });

  it("caps fresh cards in mixed sessions without touching due cards", () => {
    const uncapped = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 1, now: NOW, filter: "mixed" });
    const capped = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 1, now: NOW, filter: "mixed", newLimit: 1 });

    expect(uncapped.filter((key) => key.startsWith("item:"))).toHaveLength(3);
    expect(capped.filter((key) => key.startsWith("item:"))).toHaveLength(1);
    for (const due of dueSentences) expect(capped).toContain(due.id);
  });

  it("allows zero new cards when the daily budget is exhausted", () => {
    const mixed = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 1, now: NOW, filter: "mixed", newLimit: 0 });
    const newOnly = buildTargetedReviewQueue([], freshItems, { seed: 1, now: NOW, filter: "new", newLimit: 0 });

    expect(mixed.filter((key) => key.startsWith("item:"))).toHaveLength(0);
    expect(newOnly).toHaveLength(0);
  });

  it("is byte-identical to the uncapped queue when no limit is set", () => {
    const capped = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 7, now: NOW, filter: "new", newLimit: undefined });
    const plain = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 7, now: NOW, filter: "new" });
    expect(capped).toEqual(plain);
  });

  it("leaves all-card browsing uncapped", () => {
    const queue = buildTargetedReviewQueue(dueSentences, freshItems, { seed: 1, now: NOW, filter: "all", newLimit: 1 });
    expect(queue).toHaveLength(dueSentences.length + freshItems.length);
  });
});

// The deck renders item targets as sentence-shaped entries and dispatches grades by
// parsing the queue key: "item:<id>" goes to update_item_review, anything else is a raw
// sentence id and goes to update_review_item.
describe("mixed review session entries", () => {
  it("converts an item target into a renderable, schedulable deck entry", () => {
    const entry = itemTargetToQueueEntry(itemTarget("i1", {
      meaning: "meaning",
      explanation: "explanation",
      repetitions: 2,
      lapses: 1,
      lastReviewedAt: "2026-07-01T10:00:00.000Z",
      dueAt: "2026-07-07T10:00:00.000Z"
    }));

    expect(entry.id).toBe("item:i1");
    expect(entry.text).toBe("Example for i1");
    expect(entry.translation).toBe("Example translation for i1");
    expect(entry.focusText).toBe("i1");
    expect(entry.focusMeaning).toBe("meaning");
    expect(entry.focusExplanation).toBe("explanation");
    expect(entry.itemType).toBe("word");
    expect(entry.repetitions).toBe(2);
    expect(entry.lapses).toBe(1);
    expect(entry.dueAt).toBe("2026-07-07T10:00:00.000Z");
    expect(entry.reviewState).toBe("remembered");
    expect(entry.lessonId).toBe("");
  });

  it("marks a never-graded item entry as a new card", () => {
    const entry = itemTargetToQueueEntry(itemTarget("i1"));
    expect(entry.reviewState).toBe("unknown");
    expect(entry.repetitions).toBe(0);
  });

  it("dispatches grades by target kind from the queue key", () => {
    const sentenceKey = "b7f0a6f0-0000-4000-8000-000000000000";
    const itemKey = itemTargetToQueueEntry(itemTarget("i1")).id;

    expect(parseReviewTargetKey(sentenceKey)).toBeNull();
    expect(parseReviewTargetKey(itemKey)).toEqual({ kind: "item", id: "i1" });
  });

  it("applies optimistic grading to item entries like any other card", () => {
    const entry = itemTargetToQueueEntry(itemTarget("i1"));
    const reviewedAt = new Date(NOW);

    const graded = applyReviewDecision(entry, "remembered", reviewedAt);

    expect(graded.id).toBe("item:i1");
    expect(graded.repetitions).toBe(1);
    expect(graded.reviewState).toBe("remembered");
    expect(new Date(graded.dueAt ?? 0).getTime()).toBeGreaterThan(reviewedAt.getTime());
  });

  it("keeps mixed queues resumable through target keys", () => {
    const sentences = [sentence("a"), sentence("b")];
    const items = [itemTarget("i1")];
    const queue = buildTargetedReviewQueue(sentences, items, { seed: 9, now: NOW, filter: "all" });
    const entries = [...sentences, ...items.map(itemTargetToQueueEntry)];

    for (const key of queue) {
      expect(entries.some((candidate) => candidate.id === key)).toBe(true);
    }
  });
});
