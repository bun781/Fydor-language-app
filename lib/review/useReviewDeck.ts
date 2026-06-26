"use client";

import { useCallback, useEffect, useState } from "react";
import { updateReviewItem } from "@/lib/desktopApi";
import {
  applyReviewDecision,
  summarizeReviewSentences
} from "./algorithm";
import { buildInterleavedReviewQueue, type ReviewQueueFilter } from "./queue";
import type { ReviewDecision, ReviewSentence } from "./types";

interface ReviewDeckState {
  order: string[];
  position: number;
  sentences: ReviewSentence[];
  saving: boolean;
  error: string | null;
  filter: ReviewQueueFilter;
  started: boolean;
}

export function useReviewDeck(initialSentences: ReviewSentence[]) {
  const [state, setState] = useState<ReviewDeckState>(() => ({
    order: [],
    position: 0,
    sentences: initialSentences,
    saving: false,
    error: null,
    filter: "mixed",
    started: false
  }));

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      order: [],
      position: 0,
      sentences: initialSentences,
      started: false
    }));
  }, [initialSentences]);

  const currentId = state.order[state.position] ?? null;
  const currentSentence = currentId ? state.sentences.find((sentence) => sentence.id === currentId) ?? null : null;
  const summary = summarizeReviewSentences(state.sentences);

  const toggleShuffle = useCallback(() => {}, []);

  const startReview = useCallback((filter: ReviewQueueFilter = "mixed") => {
    setState((prev) => ({
      ...prev,
      filter,
      started: true,
      position: 0,
      order: buildInterleavedReviewQueue(prev.sentences, { filter, seed: Date.now(), shuffled: true })
    }));
  }, []);

  const reviewCurrent = useCallback(async (decision: ReviewDecision) => {
    if (!currentSentence || state.saving) return;

    const reviewedAt = new Date();
    const updatedSentence = applyReviewDecision(currentSentence, decision, reviewedAt);
    const nextSentences = state.sentences.map((sentence) => (sentence.id === currentSentence.id ? updatedSentence : sentence));
    const nextPosition = state.position + 1;

    setState((prev) => ({
      ...prev,
      sentences: nextSentences,
      saving: true,
      error: null,
      order: nextPosition >= prev.order.length ? [] : prev.order,
      position: nextPosition >= prev.order.length ? 0 : nextPosition
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
  }, [currentSentence, state.position, state.saving, state.sentences]);

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
    shuffleEnabled: true,
    reviewCurrent,
    toggleShuffle
  };
}
