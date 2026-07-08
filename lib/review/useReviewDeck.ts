"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateItemReview, updateReviewItem } from "@/lib/desktopApi";
import { clearSessionProgress, readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { applyReviewDecision } from "./scheduler";
import {
  buildInterleavedReviewQueue,
  itemTargetToQueueEntry,
  parseReviewTargetKey,
  summarizeReviewSentences,
  type ReviewQueueFilter
} from "./queue";
import {
  buildReviewSessionSummary,
  classifyReviewSource,
  type ReviewSessionEvent,
  type ReviewSessionSummary
} from "./sessionSummary";
import type { ReviewDecision, ReviewSentence } from "./types";
import { z } from "zod";

const REVIEW_DECK_PROGRESS_KEY = "review.deck";

interface ReviewDeckState {
  order: string[];
  position: number;
  sentences: ReviewSentence[];
  saving: boolean;
  error: string | null;
  filter: ReviewQueueFilter;
  started: boolean;
  activeSession: {
    startedAt: Date;
    queueIds: string[];
    reviewed: ReviewSessionEvent[];
  } | null;
  completedSession: {
    filter: ReviewQueueFilter | "custom";
    label: string;
    summary: ReviewSessionSummary;
  } | null;
}

const reviewDecisionSchema = z.enum(["forgot", "hard", "remembered", "easy", "forgotten"]);
const reviewQueueFilterSchema = z.enum(["mixed", "due", "new", "all"]);

const reviewSentenceSchema = z.object({
  id: z.string(),
  sentenceId: z.string().optional(),
  lessonId: z.string().optional(),
  importId: z.string().optional(),
  language: z.string(),
  text: z.string(),
  translation: z.string(),
  reviewState: z.enum(["unknown", "remembered", "forgotten"]),
  reviewStreak: z.number(),
  reviewedAt: z.string().nullable(),
  dueAt: z.string().optional(),
  lastReviewedAt: z.string().nullable().optional(),
  repetitions: z.number().optional(),
  lapses: z.number().optional(),
  difficulty: z.number().optional(),
  stability: z.number().optional(),
  recallMode: z.enum(["full_support", "translation_hidden", "sentence_only", "fill_blank", "reverse_translate"]).optional(),
  schedulerEngine: z.enum(["fixed-interval", "fsrs"]).optional(),
  focusText: z.string().nullable().optional(),
  focusMeaning: z.string().nullable().optional(),
  focusExplanation: z.string().nullable().optional(),
  itemType: z.enum(["word", "grammar", "chunk"]).optional()
});

const reviewSessionEventSchema = z.object({
  sentenceId: z.string(),
  lessonId: z.string().optional(),
  text: z.string(),
  translation: z.string(),
  decision: reviewDecisionSchema,
  before: reviewSentenceSchema,
  after: reviewSentenceSchema,
  sourceBucket: z.enum(["due", "new", "mastered"])
});

const activeSessionSchema = z.object({
  startedAt: z.union([z.string(), z.date()]).transform((value, ctx) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date" });
      return z.NEVER;
    }
    return date;
  }),
  queueIds: z.array(z.string()),
  reviewed: z.array(reviewSessionEventSchema)
});

const completedSessionSchema = z.object({
  filter: z.union([reviewQueueFilterSchema, z.literal("custom")]),
  label: z.string(),
  summary: z.custom<ReviewSessionSummary>((value) => Boolean(value))
});

const reviewDeckProgressSchema = z.object({
  order: z.array(z.string()),
  position: z.number().int(),
  filter: reviewQueueFilterSchema,
  started: z.boolean(),
  activeSession: z.unknown().transform((value) => activeSessionSchema.safeParse(value).data ?? null),
  completedSession: z.unknown().transform((value) => completedSessionSchema.safeParse(value).data ?? null)
}).transform((item) => ({
  order: item.order,
  position: item.position,
  sentences: [],
  saving: false,
  error: null,
  filter: item.filter,
  started: item.started,
  activeSession: item.activeSession,
  completedSession: item.completedSession
}));

export interface ReviewDeckOptions {
  // Daily new-card cap remaining today; undefined means uncapped. Applied when the
  // queue is built, so it bounds "mixed" and "new" sessions but not "all" browsing.
  newLimit?: number;
}

export function useReviewDeck(initialSentences: ReviewSentence[], options: ReviewDeckOptions = {}) {
  const [state, setState] = useState<ReviewDeckState>(() => restoreReviewDeckState(initialSentences) ?? ({
    order: [],
    position: 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    filter: "mixed",
    started: false,
    activeSession: null,
    completedSession: null
  }));

  useEffect(() => {
    setState((prev) => {
      const restored = restoreReviewDeckState(initialSentences);
      if (restored) return restored;

      return {
        ...prev,
        order: [],
        position: 0,
        sentences: initialSentences,
        started: false,
        activeSession: null,
        completedSession: null
      };
    });
  }, [initialSentences]);

  useEffect(() => {
    writeReviewDeckState(state);
  }, [state]);

  const reviewInFlightRef = useRef(false);
  const currentId = state.order[state.position] ?? null;
  const currentSentence = currentId ? state.sentences.find((sentence) => sentence.id === currentId) ?? null : null;
  const summary = summarizeReviewSentences(state.sentences);

  const newLimit = options.newLimit;
  const startReview = useCallback((filter: ReviewQueueFilter = "mixed") => {
    setState((prev) => {
      const startedAt = new Date();
      const order = buildInterleavedReviewQueue(prev.sentences, { filter, seed: startedAt.getTime(), shuffled: true, now: startedAt, newLimit });

      return {
        ...prev,
        filter,
        started: order.length > 0,
        position: 0,
        order,
        error: null,
        activeSession: order.length > 0 ? { startedAt, queueIds: order, reviewed: [] } : null,
        completedSession: null
      };
    });
  }, [newLimit]);

  const startFocusedReview = useCallback((sentenceIds: string[], label = "Targeted retry") => {
    setState((prev) => {
      const seen = new Set<string>();
      const order = sentenceIds.filter((id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return prev.sentences.some((sentence) => sentence.id === id);
      });

      return {
        ...prev,
        started: order.length > 0,
        position: 0,
        order,
        error: null,
        activeSession: order.length > 0
          ? {
              startedAt: new Date(),
              queueIds: order,
              reviewed: []
            }
          : null,
        completedSession: order.length > 0
          ? null
          : {
              filter: "custom",
              label,
              summary: buildReviewSessionSummary([])
            }
      };
    });
  }, []);

  const returnToMenu = useCallback(() => {
    clearSessionProgress(REVIEW_DECK_PROGRESS_KEY);
    setState((prev) => ({
      ...prev,
      order: [],
      position: 0,
      saving: false,
      error: null,
      started: false,
      activeSession: null,
      completedSession: null
    }));
  }, []);

  const reviewCurrent = useCallback(async (decision: ReviewDecision) => {
    // Synchronous guard: rapid repeat keypresses can fire before React re-renders with saving=true.
    if (reviewInFlightRef.current) return;
    if (!currentSentence || state.saving || !state.activeSession) return;
    reviewInFlightRef.current = true;

    const reviewedAt = new Date();
    const updatedSentence = applyReviewDecision(currentSentence, decision, reviewedAt);
    const nextSentences = state.sentences.map((sentence) => (sentence.id === currentSentence.id ? updatedSentence : sentence));
    const nextPosition = state.position + 1;
    const event: ReviewSessionEvent = {
      sentenceId: currentSentence.id,
      lessonId: currentSentence.lessonId,
      text: currentSentence.text,
      translation: currentSentence.translation,
      decision,
      before: currentSentence,
      after: updatedSentence,
      sourceBucket: classifyReviewSource(currentSentence, state.activeSession.startedAt)
    };
    const reviewedEvents = [...state.activeSession.reviewed, event];
    const sessionFinished = nextPosition >= state.order.length;

    setState((prev) => ({
      ...prev,
      sentences: nextSentences,
      saving: true,
      error: null,
      order: sessionFinished ? [] : prev.order,
      position: sessionFinished ? 0 : nextPosition,
      activeSession: sessionFinished
        ? null
        : {
            ...prev.activeSession!,
            reviewed: reviewedEvents
          },
      completedSession: sessionFinished
        ? {
            filter: prev.filter,
            label: getSessionLabel(prev.filter),
            summary: buildReviewSessionSummary(reviewedEvents)
          }
        : null
    }));

    try {
      // Entries with an "item:<id>" key persist through the item-level command; any
      // other key is a raw sentence id and follows the unchanged sentence path.
      const itemTarget = parseReviewTargetKey(currentSentence.id);
      const savedSentence = itemTarget?.kind === "item"
        ? itemTargetToQueueEntry(await updateItemReview(itemTarget.id, decision))
        : await updateReviewItem(currentSentence.id, decision);
      setState((prev) => ({
        ...prev,
        sentences: prev.sentences.map((sentence) => (sentence.id === savedSentence.id ? savedSentence : sentence))
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Unable to save review decision."
      }));
    } finally {
      reviewInFlightRef.current = false;
      setState((prev) => ({ ...prev, saving: false }));
    }
  }, [currentSentence, state.activeSession, state.order.length, state.position, state.saving, state.sentences]);

  return {
    currentSentence,
    position: state.position,
    summary,
    total: state.sentences.length,
    queueTotal: state.order.length,
    saving: state.saving,
    error: state.error,
    started: state.started,
    filter: state.filter,
    startReview,
    startFocusedReview,
    returnToMenu,
    completedSession: state.completedSession,
    reviewCurrent
  };
}

function getSessionLabel(filter: ReviewQueueFilter) {
  if (filter === "due") return "Due review";
  if (filter === "new") return "New cards";
  if (filter === "all") return "Full review";
  return "Mixed review";
}

function restoreReviewDeckState(initialSentences: ReviewSentence[]): ReviewDeckState | null {
  const saved = readSessionProgress(REVIEW_DECK_PROGRESS_KEY, reviewDeckProgressSchema);
  if (!saved) return null;

  const sentenceIds = new Set(initialSentences.map((sentence) => sentence.id));
  const order = saved.order.filter((id) => sentenceIds.has(id));
  const hasActiveOrder = saved.started && order.length > 0;
  const started = hasActiveOrder || Boolean(saved.completedSession);

  return {
    ...saved,
    order: hasActiveOrder ? order : [],
    position: hasActiveOrder ? Math.min(Math.max(0, saved.position), Math.max(0, order.length - 1)) : 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    started,
    activeSession: hasActiveOrder && saved.activeSession
      ? {
          startedAt: saved.activeSession.startedAt,
          queueIds: saved.activeSession.queueIds.filter((id) => sentenceIds.has(id)),
          reviewed: saved.activeSession.reviewed.filter((event) => sentenceIds.has(event.sentenceId))
        }
      : null
  };
}

function writeReviewDeckState(state: ReviewDeckState) {
  writeSessionProgress(REVIEW_DECK_PROGRESS_KEY, {
    ...state,
    saving: false,
    error: null
  });
}
