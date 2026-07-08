export type SentenceReviewState = "unknown" | "remembered" | "forgotten";
export type ReviewGrade = "forgot" | "hard" | "remembered" | "easy";
export type ReviewDecision = ReviewGrade | "forgotten";
export type SchedulerEngineId = "fixed-interval" | "fsrs";
export type RecallMode =
  | "full_support"
  | "translation_hidden"
  | "sentence_only"
  | "fill_blank"
  | "reverse_translate";

export interface ReviewSentence {
  id: string;
  sentenceId?: string;
  lessonId?: string;
  importId?: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: string | null;
  dueAt?: string;
  lastReviewedAt?: string | null;
  repetitions?: number;
  lapses?: number;
  difficulty?: number;
  stability?: number;
  recallMode?: RecallMode;
  schedulerEngine?: SchedulerEngineId;
  focusText?: string | null;
  focusMeaning?: string | null;
  focusExplanation?: string | null;
  // Set only on entries derived from a ReviewItemTarget ("item:<id>" queue keys).
  itemType?: "word" | "grammar" | "chunk";
}

export interface ReviewSentenceRow {
  id: string;
  sentenceId?: string;
  lessonId?: string;
  importId?: string;
  language: string;
  text: string;
  translation: string;
  reviewState: SentenceReviewState;
  reviewStreak: number;
  reviewedAt: Date | null;
  dueAt?: Date;
  lastReviewedAt?: Date | null;
  repetitions?: number;
  lapses?: number;
  difficulty?: number;
  stability?: number;
  recallMode?: RecallMode;
  schedulerEngine?: SchedulerEngineId;
  focusText?: string | null;
  focusMeaning?: string | null;
  focusExplanation?: string | null;
}

// Aggregated review history and mastery counters for the progress layer (streaks,
// heatmaps, mastery %). Mirrors ReviewProgressSnapshot in src-tauri/src/models.rs.
// daily_activity days are local dates ("YYYY-MM-DD"), ascending.
export interface ReviewDayActivity {
  day: string;
  reviews: number;
  newCards: number;
}

export interface ReviewMasteryStats {
  total: number;
  graded: number;
  mastered: number;
}

export interface ReviewProgressSnapshot {
  dailyActivity: ReviewDayActivity[];
  itemStats: ReviewMasteryStats;
  sentenceStats: ReviewMasteryStats;
}

export type ReviewResetScope =
  | { type: "lesson"; lessonId: string }
  | { type: "sentence"; sentenceId: string }
  | { type: "item"; itemType: "word" | "grammar" | "chunk"; canonicalKey: string; lessonId?: string };

// A canonical learning item as a review target: its persisted scheduling state (from
// item_review_states, or new-item defaults when never graded) plus the best sentence
// example to review it through. Mirrors ReviewItemTarget in src-tauri/src/models.rs.
export interface ReviewItemTarget {
  id: string;
  itemType: "word" | "grammar" | "chunk";
  canonicalKey: string;
  displayText: string;
  meaning: string | null;
  explanation: string | null;
  language: string;
  dueAt: string;
  lastReviewedAt: string | null;
  repetitions: number;
  lapses: number;
  difficulty: number;
  stability: number;
  schedulerEngine: SchedulerEngineId;
  exampleSentenceId: string;
  exampleText: string;
  exampleTranslation: string;
  exampleSurfaceText: string;
  exampleCount: number;
}
