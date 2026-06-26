"use client";

import { useCallback, useEffect, useState } from "react";
import { updateReviewItem } from "@/lib/desktopApi";
import {
  applyReviewDecision,
  summarizeReviewSentences
} from "./algorithm";
import { buildInterleavedReviewQueue, type ReviewQueueFilter } from "./queue";
import {
  buildReviewSessionSummary,
  classifyReviewSource,
  type ReviewSessionEvent,
  type ReviewSessionSummary
} from "./sessionSummary";
import type { ReviewDecision, ReviewSentence } from "./types";

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

export function useReviewDeck(initialSentences: ReviewSentence[]) {
  const [state, setState] = useState<ReviewDeckState>(() => ({
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
    setState((prev) => ({
      ...prev,
      order: [],
      position: 0,
      sentences: initialSentences,
      started: false,
      activeSession: null,
      completedSession: null
    }));
  }, [initialSentences]);

  const currentId = state.order[state.position] ?? null;
  const currentSentence = currentId ? state.sentences.find((sentence) => sentence.id === currentId) ?? null : null;
  const summary = summarizeReviewSentences(state.sentences);

  const toggleShuffle = useCallback(() => {}, []);

  const startReview = useCallback((filter: ReviewQueueFilter = "mixed") => {
    setState((prev) => {
      const startedAt = new Date();
      const order = buildInterleavedReviewQueue(prev.sentences, { filter, seed: startedAt.getTime(), shuffled: true, now: startedAt });

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
  }, []);

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

  const reviewCurrent = useCallback(async (decision: ReviewDecision) => {
    if (!currentSentence || state.saving || !state.activeSession) return;

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
      const savedSentence = await updateReviewItem(currentSentence.id, decision);
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
    completedSession: state.completedSession,
    shuffleEnabled: true,
    reviewCurrent,
    toggleShuffle
  };
}

function getSessionLabel(filter: ReviewQueueFilter) {
  if (filter === "due") return "Due review";
  if (filter === "new") return "New cards";
  if (filter === "all") return "Full review";
  return "Mixed review";
}
