"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import { PageState } from "@/components/system/PageState";
import { getReviewQueue } from "@/lib/desktopApi";
import type { ReviewSentence } from "@/lib/review/types";

export default function ReviewPage() {
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getReviewQueue()
      .then((queue) => {
        if (!cancelled) setSentences(queue);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load review sentences.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      {loading ? (
        <PageState eyebrow="Loading" title="Loading review" description="Preparing your sentence queue." />
      ) : error ? (
        <PageState
          eyebrow="Storage error"
          tone="error"
          title="Review failed to load"
          description={error}
          actions={<a className="button" href="/review">Retry</a>}
        />
      ) : sentences.length ? (
        <ReviewDeck sentences={sentences} />
      ) : (
        <PageState
          eyebrow="No data yet"
          title="No sentences to review"
          description="Import a lesson first. Once a lesson saves sentences into the database, they will appear here for review."
          actions={<a className="button" href="/lessons/manage">Open lesson manager</a>}
        />
      )}
    </AppShell>
  );
}
