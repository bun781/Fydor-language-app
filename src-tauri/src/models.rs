use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonWordInput {
    pub surface: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lemma: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonGrammarInput {
    pub pattern: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonChunkInput {
    pub surface: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meaning: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    pub item_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonSentenceInput {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub translation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub words: Option<Vec<LessonWordInput>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grammar: Option<Vec<LessonGrammarInput>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunks: Option<Vec<LessonChunkInput>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LessonImportInput {
    pub language: String,
    pub base_language: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    pub sentences: Vec<LessonSentenceInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyLessonMeta {
    pub id: String,
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    pub sentence_count: i64,
    pub purpose: String,
    pub published_stable_id: Option<String>,
    pub published_version: Option<String>,
    pub pack_id: Option<String>,
    pub pack_title: Option<String>,
    pub pack_position: Option<i64>,
    pub pack_archived: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyPackMeta {
    pub id: String,
    pub stable_id: String,
    pub title: String,
    pub description: Option<String>,
    pub author_name: Option<String>,
    pub organization: Option<String>,
    pub author_url: Option<String>,
    pub language: String,
    pub base_language: String,
    pub level: Option<String>,
    pub tags: Vec<String>,
    pub version: String,
    pub license: Option<String>,
    pub source_type: String,
    pub archived: bool,
    pub lesson_count: i64,
    pub sentence_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyWord {
    pub surface: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub common_mistakes: Vec<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyGrammar {
    pub surface_text: String,
    pub pattern: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub common_mistakes: Vec<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyChunk {
    pub surface_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub canonical_key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudySentence {
    pub id: String,
    pub text: String,
    pub translation: String,
    pub audio_url: Option<String>,
    pub words: Vec<StudyWord>,
    pub grammar: Vec<StudyGrammar>,
    pub chunks: Vec<StudyChunk>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyLesson {
    pub id: String,
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub source: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
    pub sentences: Vec<StudySentence>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSentence {
    pub id: String,
    pub sentence_id: String,
    pub lesson_id: String,
    pub import_id: String,
    pub language: String,
    pub text: String,
    pub translation: String,
    pub review_state: String,
    pub review_streak: i64,
    pub reviewed_at: Option<String>,
    pub due_at: String,
    pub last_reviewed_at: Option<String>,
    pub repetitions: i64,
    pub lapses: i64,
    pub difficulty: f64,
    pub stability: f64,
    pub recall_mode: String,
    pub scheduler_engine: String,
    pub focus_text: Option<String>,
    pub focus_meaning: Option<String>,
    pub focus_explanation: Option<String>,
    pub pack_position: Option<i64>,
    pub lesson_position: Option<i64>,
}

// A canonical learning item as a review target: its scheduling state (from
// item_review_states, or new-item defaults when no row exists) plus the best sentence
// example to review it through. Mirrors ReviewItemTarget in lib/review/types.ts.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewItemTarget {
    pub id: String,
    pub item_type: String,
    pub canonical_key: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub language: String,
    pub due_at: String,
    pub last_reviewed_at: Option<String>,
    pub repetitions: i64,
    pub lapses: i64,
    pub difficulty: f64,
    pub stability: f64,
    pub scheduler_engine: String,
    pub example_sentence_id: String,
    pub example_text: String,
    pub example_translation: String,
    pub example_surface_text: String,
    pub example_count: i64,
}

// Aggregated review history and mastery counters for the progress layer (streaks,
// heatmaps, mastery %). Mirrors ReviewProgressSnapshot in lib/review/types.ts.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewDayActivity {
    pub day: String,
    pub reviews: i64,
    pub new_cards: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewMasteryStats {
    pub total: i64,
    pub graded: i64,
    pub mastered: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewProgressSnapshot {
    pub daily_activity: Vec<ReviewDayActivity>,
    pub item_stats: ReviewMasteryStats,
    pub sentence_stats: ReviewMasteryStats,
}

// Minimal inputs for the reading analyzer so large libraries do not require loading
// every full lesson in the frontend. Mirrors ReadingInputs in lib/reading/analyzer.ts.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingLexiconInput {
    pub item_type: String,
    pub canonical_key: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub surfaces: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingItemStateInput {
    pub item_type: String,
    pub canonical_key: String,
    pub repetitions: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadingInputs {
    pub lexicon: Vec<ReadingLexiconInput>,
    pub item_states: Vec<ReadingItemStateInput>,
    pub remembered_sentence_keys: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewLesson {
    pub language: String,
    pub base_language: String,
    pub title: String,
    pub description: Option<String>,
    pub source: Option<String>,
    pub level: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewSentence {
    pub index: usize,
    pub text: String,
    pub translation: String,
    pub duplicate_sentence: bool,
    pub words: Vec<LessonWordOutput>,
    pub grammar: Vec<LessonGrammarOutput>,
    pub chunks: Vec<LessonChunkOutput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonWordOutput {
    pub surface: String,
    pub lemma: Option<String>,
    pub meaning: Option<String>,
    pub role: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonGrammarOutput {
    pub pattern: String,
    pub surface: Option<String>,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonChunkOutput {
    pub surface: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub level: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewItem {
    pub canonical_key: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub display_text: String,
    pub meaning: Option<String>,
    pub explanation: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportPreviewResult {
    pub lesson: LessonImportPreviewLesson,
    pub sentence_count: usize,
    pub duplicate_import: bool,
    pub validation_errors: Vec<String>,
    pub sentences: Vec<LessonImportPreviewSentence>,
    pub vocabulary: Vec<LessonImportPreviewItem>,
    pub grammar: Vec<LessonImportPreviewItem>,
    pub chunks: Vec<LessonImportPreviewItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LessonImportSummary {
    pub lesson_id: Option<String>,
    pub lesson_created: bool,
    pub lesson_updated: bool,
    pub sentences_imported: i64,
    pub sentences_skipped: i64,
    pub vocabulary_created: i64,
    pub vocabulary_reused: i64,
    pub grammar_created: i64,
    pub grammar_reused: i64,
    pub chunks_created: i64,
    pub chunks_reused: i64,
    pub links_created: i64,
    pub errors: Vec<String>,
}
