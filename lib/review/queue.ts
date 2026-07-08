// Source of truth for review queue ordering. The interleaving ratios (30% fresh, 12% mastered) are intentional; do not adjust without product review.
import type { ReviewItemTarget, ReviewSentence, SentenceReviewState } from "./types";

export type ReviewQueueFilter = "mixed" | "due" | "new" | "all";

export type ReviewTargetKind = "sentence" | "item";

export function makeReviewTargetKey(kind: ReviewTargetKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseReviewTargetKey(key: string): { kind: ReviewTargetKind; id: string } | null {
  const separatorIndex = key.indexOf(":");
  if (separatorIndex < 0) return null;
  const kind = key.slice(0, separatorIndex);
  const id = key.slice(separatorIndex + 1);
  if (!id) return null;
  if (kind !== "sentence" && kind !== "item") return null;
  return { kind, id };
}

export interface ReviewQueueOptions {
  filter?: ReviewQueueFilter;
  seed?: number;
  shuffled?: boolean;
  now?: Date;
  // Daily new-card cap: at most this many never-graded cards enter "mixed" and "new"
  // queues. Undefined means uncapped; "all" is a full browse and ignores it.
  newLimit?: number;
}

/**
 * Converts a persisted item target into the sentence-shaped entry the deck renders and
 * schedules, so sentences and items ride the same due/fresh/mastered interleaving.
 * Item entries are namespaced as "item:<learningItemId>" (parse with parseReviewTargetKey;
 * a key that does not parse is a raw sentence id).
 */
export function itemTargetToQueueEntry(item: ReviewItemTarget): ReviewSentence {
  return {
    id: makeReviewTargetKey("item", item.id),
    language: item.language,
    text: item.exampleText,
    translation: item.exampleTranslation,
    reviewState: item.repetitions === 0 ? "unknown" : "remembered",
    reviewStreak: item.repetitions,
    reviewedAt: item.lastReviewedAt,
    dueAt: item.dueAt,
    lastReviewedAt: item.lastReviewedAt,
    repetitions: item.repetitions,
    lapses: item.lapses,
    difficulty: item.difficulty,
    stability: item.stability,
    schedulerEngine: item.schedulerEngine,
    // Items are cross-lesson; an empty lessonId opts them out of same-lesson-run avoidance.
    lessonId: "",
    focusText: item.exampleSurfaceText,
    focusMeaning: item.meaning,
    focusExplanation: item.explanation,
    itemType: item.itemType
  };
}

const statePriority: Record<SentenceReviewState, number> = {
  forgotten: 0,
  unknown: 1,
  remembered: 2
};

export function buildInterleavedReviewQueue(
  sentences: ReviewSentence[],
  options: ReviewQueueOptions = {}
): string[] {
  const uniqueSentences = uniqueById(sentences);
  const filter = options.filter ?? "mixed";
  const now = options.now ?? new Date();
  const rng = createSeededRng(options.seed ?? Date.now());
  const shuffled = options.shuffled ?? true;

  const due = uniqueSentences.filter((sentence) => isDue(sentence, now) && (sentence.repetitions ?? 0) > 0);
  const fresh = uniqueSentences.filter((sentence) => (sentence.repetitions ?? 0) === 0);
  const mastered = uniqueSentences.filter((sentence) => !isDue(sentence, now) && (sentence.repetitions ?? 0) > 0);

  if (filter === "due") return orderedIds(due, rng, shuffled);
  if (filter === "new") {
    const orderedFresh = ordered(fresh, rng, shuffled);
    const limited = options.newLimit === undefined ? orderedFresh : take(orderedFresh, options.newLimit);
    return limited.map((sentence) => sentence.id);
  }
  if (filter === "all") return orderedIds(uniqueSentences, rng, shuffled);

  const duePicked = ordered(due, rng, shuffled);
  const uncappedFreshTarget = duePicked.length ? Math.max(1, Math.ceil(duePicked.length * 0.3)) : fresh.length;
  const freshTarget = options.newLimit === undefined
    ? uncappedFreshTarget
    : Math.min(uncappedFreshTarget, Math.max(0, options.newLimit));
  const freshPicked = take(ordered(fresh, rng, shuffled), freshTarget);
  const masteredTarget = Math.max(1, Math.ceil((duePicked.length + freshPicked.length) * 0.12));
  const masteredPicked = take(ordered(mastered, rng, shuffled), masteredTarget);
  const picked = weightedMerge(duePicked, freshPicked, masteredPicked);

  const fallback = picked.length ? picked : uniqueSentences;
  return avoidSameLessonRuns(ordered(fallback, rng, true)).map((sentence) => sentence.id);
}

export function summarizeReviewSentences(sentences: ReviewSentence[]) {
  return sentences.reduce(
    (snapshot, sentence) => {
      snapshot.total += 1;
      snapshot[sentence.reviewState] += 1;
      return snapshot;
    },
    { total: 0, remembered: 0, forgotten: 0, unknown: 0 } satisfies Record<"total" | SentenceReviewState, number>
  );
}

function uniqueById<T extends { id: string }>(sentences: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const sentence of sentences) {
    if (seen.has(sentence.id)) continue;
    seen.add(sentence.id);
    unique.push(sentence);
  }

  return unique;
}

function isDue(sentence: ReviewSentence, now: Date): boolean {
  return new Date(sentence.dueAt ?? 0).getTime() <= now.getTime();
}

function orderedIds(sentences: ReviewSentence[], rng: () => number, shuffled: boolean): string[] {
  return ordered(sentences, rng, shuffled).map((sentence) => sentence.id);
}

function ordered(sentences: ReviewSentence[], rng: () => number, shuffled: boolean): ReviewSentence[] {
  const sorted = [...sentences].sort((a, b) => {
    const dueDiff = new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime();
    if (dueDiff !== 0) return dueDiff;
    return scoreReviewSentence(a) - scoreReviewSentence(b);
  });
  return shuffled ? shuffle(sorted, rng) : sorted;
}

function scoreReviewSentence(sentence: ReviewSentence): number {
  const baseScore = statePriority[sentence.reviewState] * 100;
  const streakPenalty = sentence.reviewState === "remembered" ? sentence.reviewStreak * 10 : 0;
  return baseScore + streakPenalty;
}

function take<T>(values: T[], count: number): T[] {
  return values.slice(0, Math.max(0, count));
}

function weightedMerge(due: ReviewSentence[], fresh: ReviewSentence[], mastered: ReviewSentence[]): ReviewSentence[] {
  const result: ReviewSentence[] = [];
  const buckets = [
    { values: due, index: 0 },
    { values: fresh, index: 0 },
    { values: mastered, index: 0 }
  ];
  const pattern = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

  while (buckets.some((bucket) => bucket.index < bucket.values.length)) {
    for (const bucketIndex of pattern) {
      const bucket = buckets[bucketIndex];
      if (bucket.index < bucket.values.length) {
        result.push(bucket.values[bucket.index]);
        bucket.index += 1;
      }
    }
  }

  return result;
}

function avoidSameLessonRuns(sentences: ReviewSentence[]): ReviewSentence[] {
  const queue = [...sentences];
  for (let index = 1; index < queue.length; index += 1) {
    if (!queue[index - 1].lessonId || queue[index - 1].lessonId !== queue[index].lessonId) continue;
    const swapIndex = queue.findIndex((candidate, candidateIndex) => (
      candidateIndex > index && candidate.lessonId !== queue[index - 1].lessonId
    ));
    if (swapIndex > index) {
      [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
    }
  }
  return queue;
}

function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], rng: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
