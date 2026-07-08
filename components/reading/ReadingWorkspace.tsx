"use client";

import { FileText, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getLessonCached, getLessons, getReadingInputs, getReviewQueue } from "@/lib/desktopApi";
import type { StudyLesson, StudySentence } from "@/lib/imported-content/types";
import {
  analyzeReadingText,
  buildReadingLexicon,
  deriveReadingKnowledge,
  lexiconInputsToEntries,
  type ReadingLexiconEntry
} from "@/lib/reading/analyzer";
import type { ReviewSentence } from "@/lib/review/types";
import { PageState } from "@/components/system/PageState";

const SAMPLE_TEXT = "Paste reading material here. Fydor will match imported words, grammar, and chunks from your local lessons.";

interface ReadingKnowledge {
  lexicon: ReadingLexiconEntry[];
  knownCanonicalKeys: Set<string>;
  learningCanonicalKeys: Set<string>;
}

const EMPTY_KNOWLEDGE: ReadingKnowledge = {
  lexicon: [],
  knownCanonicalKeys: new Set(),
  learningCanonicalKeys: new Set()
};

export function ReadingWorkspace() {
  const [knowledge, setKnowledge] = useState<ReadingKnowledge>(EMPTY_KNOWLEDGE);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadReadingData();
  }, []);

  async function loadReadingData() {
    setLoading(true);
    setError(null);
    try {
      setKnowledge(await loadReadingKnowledge());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reading data.");
    } finally {
      setLoading(false);
    }
  }

  const analysis = useMemo(
    () => analyzeReadingText(text, knowledge.lexicon, knowledge.knownCanonicalKeys, {
      learningCanonicalKeys: knowledge.learningCanonicalKeys
    }),
    [knowledge, text]
  );

  if (loading) {
    return (
      <PageState
        eyebrow="Reading"
        title="Loading your local knowledge graph"
        description="Fydor is collecting imported sentence annotations and review state from SQLite."
      />
    );
  }

  if (error) {
    return (
      <PageState
        eyebrow="Reading"
        title="Reading data could not load"
        description="The reading workbench only uses local app data, so this usually means the Tauri bridge is unavailable."
        details={error}
        tone="error"
        actions={<button className="button secondary" type="button" onClick={() => void loadReadingData()}><RefreshCw size={15} /> Retry</button>}
      />
    );
  }

  return (
    <section className="reading-workspace">
      <div className="topbar">
        <div className="stack">
          <span className="pill pill-accent">Reading</span>
          <h1>Reading Workbench</h1>
          <p className="muted">Local token analysis from imported lesson annotations and sentence review state.</p>
        </div>
        <button className="button secondary" type="button" onClick={() => void loadReadingData()}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="reading-layout">
        <label className="reading-input-panel">
          <span className="reading-label">Text</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={SAMPLE_TEXT}
            rows={14}
          />
        </label>

        <div className="reading-analysis-panel">
          <div className="reading-metrics">
            <Metric label="Known" value={`${analysis.coverage.knownPercent}%`} />
            <Metric label="Known tokens" value={analysis.coverage.knownWordLikeTokens.toString()} />
            <Metric label="Learning" value={analysis.coverage.learningWordLikeTokens.toString()} />
            <Metric label="Unknown" value={analysis.coverage.unknownWordLikeTokens.toString()} />
          </div>

          <div className="reading-difficulty">
            <FileText size={17} />
            <span>{difficultyLabel(analysis.coverage.likelyDifficulty)}</span>
          </div>

          <div className="reading-token-view" aria-label="Analyzed reading tokens">
            {analysis.tokens.length ? analysis.tokens.map((token) => (
              <span
                key={`${token.start}:${token.end}`}
                className={`reading-token${token.match ? ` reading-token-${token.match.status}` : ""}${token.kind === "space" ? " reading-token-space" : ""}`}
                title={token.match ? `${token.match.displayText}${token.match.meaning ? `: ${token.match.meaning}` : ""}` : undefined}
              >
                {token.text}
              </span>
            )) : <span className="muted">Paste text to analyze it against your local Fydor lessons.</span>}
          </div>

          {analysis.coverage.unknownTokens.length ? (
            <div className="reading-unknowns">
              <span className="reading-label">Unknown tokens</span>
              <div className="reading-chip-row">
                {analysis.coverage.unknownTokens.slice(0, 24).map((token) => (
                  <span className="pill" key={token}>{token}</span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="reading-metric">
      <span className="metric">{value}</span>
      <span className="muted">{label}</span>
    </div>
  );
}

// Primary path: the get_reading_inputs Rust command returns the minimal analysis
// inputs (lexicon surfaces + graded item states + remembered-sentence fallback keys),
// so large libraries never load full lesson bodies here. If the command is
// unavailable, fall back to the legacy full-lesson load with sentence inference.
async function loadReadingKnowledge(): Promise<ReadingKnowledge> {
  try {
    const inputs = await getReadingInputs();
    const { knownCanonicalKeys, learningCanonicalKeys } = deriveReadingKnowledge(
      inputs.itemStates,
      inputs.rememberedSentenceKeys
    );
    return { lexicon: lexiconInputsToEntries(inputs.lexicon), knownCanonicalKeys, learningCanonicalKeys };
  } catch (err) {
    console.error("get_reading_inputs unavailable; falling back to full-lesson inference", err);
    return loadLegacyReadingKnowledge();
  }
}

async function loadLegacyReadingKnowledge(): Promise<ReadingKnowledge> {
  const [lessonMetas, queue] = await Promise.all([getLessons(), getReviewQueue()]);
  const lessons = (await Promise.all(lessonMetas.map((lesson) => getLessonCached(lesson.id))))
    .filter((lesson): lesson is StudyLesson => Boolean(lesson));
  const sentences = lessons.flatMap((lesson) => lesson.sentences);
  const { knownCanonicalKeys, learningCanonicalKeys } = inferItemStatusFromReviewedSentences(sentences, queue);
  return { lexicon: buildReadingLexicon(sentences), knownCanonicalKeys, learningCanonicalKeys };
}

function inferItemStatusFromReviewedSentences(sentences: StudySentence[], reviewRows: ReviewSentence[]) {
  const reviewedBySentenceId = new Map(reviewRows.map((row) => [row.sentenceId ?? row.id, row]));
  const knownCanonicalKeys = new Set<string>();
  const learningCanonicalKeys = new Set<string>();

  for (const sentence of sentences) {
    const row = reviewedBySentenceId.get(sentence.id);
    const target = row?.reviewState === "remembered" ? knownCanonicalKeys : learningCanonicalKeys;
    for (const key of sentenceCanonicalKeys(sentence)) target.add(key);
  }

  for (const key of knownCanonicalKeys) learningCanonicalKeys.delete(key);
  return { knownCanonicalKeys, learningCanonicalKeys };
}

function sentenceCanonicalKeys(sentence: StudySentence): string[] {
  return [
    ...sentence.words.map((word) => word.canonicalKey),
    ...sentence.grammar.map((grammar) => grammar.canonicalKey),
    ...sentence.chunks.map((chunk) => chunk.canonicalKey)
  ];
}

function difficultyLabel(value: string): string {
  if (value === "review") return "Review-friendly text";
  if (value === "i+1") return "i+1 candidate";
  if (value === "stretch") return "Stretch text";
  return "Needs more known context";
}
