import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { ReviewDeck } from "@/components/review/ReviewDeck";
import { PageState } from "@/components/system/PageState";
import { errorMessage } from "@/lib/errors";
import { getItemReviewTargets, getLessonCached, getLessons, getPacks, getReviewQueue, resetReviewProgress } from "@/lib/desktopApi";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import type { StudyLesson, StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";
import { defaultStudyScope, resolveStudyScope, studyScopeSchema, type StudyScope } from "@/lib/studyScope";
import type { ReviewItemTarget, ReviewResetScope, ReviewSentence } from "@/lib/review/types";
import { z } from "zod";

const REVIEW_SELECTION_KEY = "review.selected-lessons";

const reviewSelectionSchema = z.object({
  scope: studyScopeSchema.optional(),
  lessonIds: z.array(z.string()).optional()
});

export default function ReviewPage() {
  const [searchParams] = useSearchParams();
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [itemTargets, setItemTargets] = useState<ReviewItemTarget[]>([]);
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [packs, setPacks] = useState<StudyPackMeta[]>([]);
  const [fullLessons, setFullLessons] = useState<StudyLesson[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [studyScope, setStudyScope] = useState<StudyScope>(defaultStudyScope(true));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredSentences = useMemo(
    () => filterSentencesByLesson(sentences, selectedLessonIds),
    [selectedLessonIds, sentences]
  );
  // An item belongs to the current selection when its example sentence does — items
  // themselves are cross-lesson and carry no lessonId.
  const filteredItemTargets = useMemo(() => {
    const sentenceIds = new Set(filteredSentences.map((sentence) => sentence.id));
    return itemTargets.filter((item) => sentenceIds.has(item.exampleSentenceId));
  }, [filteredSentences, itemTargets]);
  const sentenceCountByLesson = useMemo(() => getSentenceCountByLesson(sentences), [sentences]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getReviewQueue(), getLessons(), getPacks(), loadItemTargets()])
      .then(([queue, lessonList, packList, targets]) => {
        if (cancelled) return;
        setItemTargets(targets);
        const availableLessonIds = getAvailableLessonIds(queue, lessonList);
        const savedSelection = readSessionProgress(REVIEW_SELECTION_KEY, reviewSelectionSchema);
        const restoredScope = savedSelection?.scope ?? (savedSelection?.lessonIds ? {
          ...defaultStudyScope(false),
          lessonIds: savedSelection.lessonIds
        } : defaultStudyScope(true));
        const routeLessonIds = (searchParams.get("lessonIds") ?? "").split(",").filter(Boolean);
        const restoredLessonIds = (routeLessonIds.length ? routeLessonIds : resolveStudyScope(restoredScope, lessonList, packList)).filter((id) => availableLessonIds.includes(id));

        setSentences(queue);
        setLessons(lessonList);
        setPacks(packList);
        setStudyScope(restoredScope);
        setSelectedLessonIds(restoredLessonIds.length ? restoredLessonIds : availableLessonIds);

        // Full lesson bodies are only needed by the stats browser; load them without blocking first paint.
        void Promise.all(lessonList.map((item) => getLessonCached(item.id)))
          .then((loadedLessons) => {
            if (!cancelled) setFullLessons(loadedLessons.filter((item): item is StudyLesson => Boolean(item)));
          })
          .catch(() => {
            // Stats browsing degrades gracefully without full lessons; the queue itself already loaded.
          });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, "Unable to load review sentences."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleResetProgress(scope: ReviewResetScope) {
    await resetReviewProgress(scope);
    const [queue, targets] = await Promise.all([getReviewQueue(), loadItemTargets()]);
    setSentences(queue);
    setItemTargets(targets);
  }

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
          actions={<button className="button" type="button" onClick={() => window.location.reload()}>Retry</button>}
        />
      ) : sentences.length ? (
        <ReviewDeck
          allSentenceCount={sentences.length}
          lessons={lessons}
          fullLessons={filterLessonsByLesson(fullLessons, selectedLessonIds)}
          sentenceCountByLesson={sentenceCountByLesson}
          selectedLessonIds={selectedLessonIds}
          packs={packs}
          studyScope={studyScope}
          sentences={filteredSentences}
          items={filteredItemTargets}
          onResetProgress={handleResetProgress}
          onSelectedLessonIdsChange={(lessonIds) => {
            setSelectedLessonIds(lessonIds);
            writeSessionProgress(REVIEW_SELECTION_KEY, { lessonIds, scope: { ...defaultStudyScope(false), lessonIds } });
          }}
          onStudyScopeChange={(scope) => {
            const lessonIds = resolveStudyScope(scope, lessons, packs);
            setStudyScope(scope);
            setSelectedLessonIds(lessonIds);
            writeSessionProgress(REVIEW_SELECTION_KEY, { scope });
          }}
        />
      ) : (
        <PageState
          eyebrow="No data yet"
          title="No sentences to review"
          description="Import a lesson first. Once a lesson saves sentences into the database, they will appear here for review."
          actions={<Link className="button" to="/lessons/manage">Open lesson manager</Link>}
        />
      )}
    </AppShell>
  );
}

// The item layer is additive: if it fails to load, sentence review must still work.
function loadItemTargets(): Promise<ReviewItemTarget[]> {
  return getItemReviewTargets().catch((err) => {
    console.error("Failed to load item review targets", err);
    return [];
  });
}

function filterLessonsByLesson(lessons: StudyLesson[], selectedLessonIds: string[]) {
  if (!selectedLessonIds.length) return [];
  const selected = new Set(selectedLessonIds);
  return lessons.filter((lesson) => selected.has(lesson.id));
}

function getSentenceCountByLesson(sentences: ReviewSentence[]) {
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    if (!sentence.lessonId) continue;
    counts.set(sentence.lessonId, (counts.get(sentence.lessonId) ?? 0) + 1);
  }
  return counts;
}

function getAvailableLessonIds(sentences: ReviewSentence[], lessons: StudyLessonMeta[]) {
  const lessonIds = lessons.length
    ? lessons.map((lesson) => lesson.id)
    : sentences.flatMap((sentence) => sentence.lessonId ? [sentence.lessonId] : []);
  return [...new Set(lessonIds)];
}

function filterSentencesByLesson(
  sentences: ReviewSentence[],
  selectedLessonIds: string[]
) {
  if (!sentences.some((sentence) => sentence.lessonId)) return sentences;
  if (!selectedLessonIds.length) return [];
  const selected = new Set(selectedLessonIds);
  return sentences.filter((sentence) => sentence.lessonId && selected.has(sentence.lessonId));
}
