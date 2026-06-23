"use client";

import { useMemo, useState } from "react";
import type { ItemFamiliarity, RevealState, SelectedItem, StudySentence } from "@/lib/imported-content/types";
import type { ReviewDecision } from "@/lib/review/types";
import { buildClozeCandidates, getHint } from "@/lib/imported-content/study-utils";
import { answersMatch } from "@/lib/imported-content/text-spans";
import { useSpeech } from "@/lib/useSpeech";
import { InteractiveToken } from "./InteractiveToken";
import { ProgressiveRevealControls } from "./ProgressiveRevealControls";
import { RelatedSentences } from "./RelatedSentences";
import { StudyDetailsPanel } from "./StudyDetailsPanel";
import { AudioButton } from "@/components/ui/AudioButton";
import { AnnotatedSentence } from "./AnnotatedSentence";

interface Props {
  sentence: StudySentence;
  cardIndex: number;
  totalCards: number;
  lessonTitle: string;
  language: string;
  allSentences: StudySentence[];
  reveal: RevealState;
  sessionFamiliarity: Map<string, ItemFamiliarity>;
  currentGrade: string | null;
  reviewMode: boolean;
  reviewState: ReviewDecision | null;
  isSavingReview: boolean;
  reviewError: string | null;
  onRevealTranslation: () => void;
  onToggleWordMeanings: () => void;
  onToggleGrammar: () => void;
  onToggleHint: () => void;
  onGrade: (grade: "easy" | "correct" | "hard" | "failed") => void;
  randomOrderEnabled: boolean;
  onToggleRandomOrder: () => void;
  onReview: (decision: ReviewDecision) => void;
  onPrev: () => void;
  onNext: () => void;
}

const GRADES = [
  { id: "failed", label: "Again" },
  { id: "hard", label: "Hard" },
  { id: "correct", label: "Good" },
  { id: "easy", label: "Easy" }
] as const;

export function SentenceFlashcard({
  sentence,
  cardIndex,
  totalCards,
  lessonTitle,
  language,
  allSentences,
  reveal,
  sessionFamiliarity,
  currentGrade,
  reviewMode,
  reviewState,
  isSavingReview,
  reviewError,
  onRevealTranslation,
  onToggleWordMeanings,
  onToggleGrammar,
  onToggleHint,
  onGrade,
  randomOrderEnabled,
  onToggleRandomOrder,
  onReview,
  onPrev,
  onNext
}: Props) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [clozeIndex, setClozeIndex] = useState(0);
  const [clozeAnswer, setClozeAnswer] = useState("");
  const [clozeResult, setClozeResult] = useState<"correct" | "incorrect" | null>(null);
  const [dictationAnswer, setDictationAnswer] = useState("");
  const [dictationResult, setDictationResult] = useState<"correct" | "incorrect" | null>(null);
  const speak = useSpeech(language);

  const progress = ((cardIndex + 1) / totalCards) * 100;
  const hint = reveal.hint ? getHint(sentence) : null;
  const revealInstruction = "Click or press Space to reveal";
  const clozeCandidates = useMemo(() => buildClozeCandidates(sentence), [sentence]);
  const clozeCandidate = clozeCandidates[clozeIndex % Math.max(1, clozeCandidates.length)] ?? null;

  function toggleItem(item: SelectedItem) {
    const surface =
      item.kind === "word" ? item.data.surface :
      item.kind === "grammar" ? item.data.surfaceText :
      item.data.surfaceText;
    speak(surface);
    setSelectedItem((prev) => {
      if (!prev || prev.kind !== item.kind) return item;
      const prevKey = prev.data.canonicalKey;
      const itemKey = item.data.canonicalKey;
      return prevKey === itemKey ? null : item;
    });
  }

  function isSelected(kind: SelectedItem["kind"], key: string): boolean {
    if (!selectedItem || selectedItem.kind !== kind) return false;
    return selectedItem.data.canonicalKey === key;
  }

  function checkCloze() {
    if (!clozeCandidate) return;
    setClozeResult(answersMatch(clozeAnswer, clozeCandidate.answerText) ? "correct" : "incorrect");
  }

  function nextCloze() {
    if (!clozeCandidates.length) return;
    setClozeIndex((index) => (index + 1) % clozeCandidates.length);
    setClozeAnswer("");
    setClozeResult(null);
  }

  function checkDictation() {
    setDictationResult(answersMatch(dictationAnswer, sentence.text) ? "correct" : "incorrect");
  }

  function resetDictation() {
    setDictationAnswer("");
    setDictationResult(null);
  }

  return (
    <div className="flashcard card stack">
      {/* Header */}
      <div className="row">
        <span className="muted">{lessonTitle}</span>
        <span className="pill">{reviewMode ? "Review" : "Card"} {cardIndex + 1} / {totalCards}</span>
      </div>

      {/* Progress bar */}
      <div className="flashcard-progress" role="progressbar" aria-valuenow={cardIndex + 1} aria-valuemax={totalCards}>
        <div className="flashcard-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Sentence */}
      <div className="sentence-line">
        {reveal.translation ? (
          <AnnotatedSentence sentence={sentence} />
        ) : (
          <p className="sentence-text">{sentence.text}</p>
        )}
        <AudioButton sentence={sentence.text} language={language} compact />
      </div>

      {/* Word tokens */}
      {sentence.words.length > 0 ? (
        <div className="token-row">
          {sentence.words.map((word, i) => (
            <InteractiveToken
              key={word.canonicalKey || `w${i}`}
              surface={word.surface}
              kind="word"
              displayText={word.displayText}
              meaning={word.meaning}
              explanation={word.explanation}
              showMeaning={reveal.wordMeanings}
              isSelected={isSelected("word", word.canonicalKey)}
              familiarity={sessionFamiliarity.get(word.canonicalKey)}
              onClick={() => toggleItem({ kind: "word", data: word })}
            />
          ))}
        </div>
      ) : null}

      {/* Grammar tags */}
      {sentence.grammar.length > 0 ? (
        <div className="token-row">
          {sentence.grammar.map((g, i) => (
            <InteractiveToken
              key={g.canonicalKey || `g${i}`}
              surface={g.surfaceText}
              kind="grammar"
              displayText={g.pattern}
              meaning={g.meaning}
              explanation={g.explanation}
              showMeaning={reveal.grammar}
              isSelected={isSelected("grammar", g.canonicalKey)}
              familiarity={sessionFamiliarity.get(g.canonicalKey)}
              onClick={() => toggleItem({ kind: "grammar", data: g })}
            />
          ))}
        </div>
      ) : null}

      {/* Chunk tags */}
      {sentence.chunks.length > 0 ? (
        <div className="token-row">
          {sentence.chunks.map((c, i) => (
            <InteractiveToken
              key={c.canonicalKey || `c${i}`}
              surface={c.surfaceText}
              kind="chunk"
              displayText={null}
              meaning={c.meaning}
              explanation={c.explanation}
              showMeaning={reveal.wordMeanings}
              isSelected={isSelected("chunk", c.canonicalKey)}
              familiarity={sessionFamiliarity.get(c.canonicalKey)}
              onClick={() => toggleItem({ kind: "chunk", data: c })}
            />
          ))}
        </div>
      ) : null}

      {/* Hint */}
      {hint ? <p className="flashcard-hint">{hint}</p> : null}

      {/* Reveal controls */}
      <ProgressiveRevealControls
        reveal={reveal}
        onHint={onToggleHint}
        onWordMeanings={onToggleWordMeanings}
        onGrammar={onToggleGrammar}
        onTranslation={onRevealTranslation}
      />

      <div className="practice-grid">
        <section className="practice-panel stack">
          <div className="row compact-row">
            <div>
              <h2>Cloze</h2>
              <p className="muted">Fill the hidden focus item.</p>
            </div>
            {clozeCandidate ? <span className={`pill cloze-kind-${clozeCandidate.kind}`}>{clozeCandidate.kind}</span> : null}
          </div>
          {clozeCandidate ? (
            <>
              <p className="sentence-text practice-sentence">
                <span>{sentence.text.slice(0, clozeCandidate.start)}</span>
                <span className={`cloze-blank cloze-kind-${clozeCandidate.kind}`} aria-label="Hidden answer">
                  {clozeResult === "correct" ? clozeCandidate.answerText : ""}
                </span>
                <span>{sentence.text.slice(clozeCandidate.end)}</span>
              </p>
              <div className="practice-answer-row">
                <input
                  className="input"
                  value={clozeAnswer}
                  placeholder={clozeCandidate.meaning ?? clozeCandidate.displayText}
                  onChange={(event) => {
                    setClozeAnswer(event.target.value);
                    setClozeResult(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") checkCloze();
                  }}
                />
                <button type="button" className="button secondary" onClick={checkCloze}>Check</button>
              </div>
              <div className="practice-feedback-row">
                {clozeResult === "correct" ? <span className="practice-feedback correct">Correct</span> : null}
                {clozeResult === "incorrect" ? (
                  <span className="practice-feedback incorrect">Answer: {clozeCandidate.answerText}</span>
                ) : null}
                {clozeCandidates.length > 1 ? (
                  <button type="button" className="button secondary compact-button" onClick={nextCloze}>Next blank</button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="muted">Add word, grammar, or chunk annotations to make cloze cards.</p>
          )}
        </section>

        <section className="practice-panel stack">
          <div className="row compact-row">
            <div>
              <h2>Dictation</h2>
              <p className="muted">Listen, then type the sentence.</p>
            </div>
            <AudioButton sentence={sentence.text} language={language} label="Play dictation audio" compact />
          </div>
          <input
            className="input"
            value={dictationAnswer}
            placeholder="Type what you hear"
            onChange={(event) => {
              setDictationAnswer(event.target.value);
              setDictationResult(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") checkDictation();
            }}
          />
          <div className="practice-feedback-row">
            <button type="button" className="button secondary" onClick={checkDictation}>Check</button>
            <button type="button" className="button secondary compact-button" onClick={resetDictation}>Clear</button>
            {dictationResult === "correct" ? <span className="practice-feedback correct">Correct</span> : null}
            {dictationResult === "incorrect" ? <span className="practice-feedback incorrect">Compare with the sentence above.</span> : null}
          </div>
        </section>
      </div>

      {/* Translation */}
      <div
        className={`flashcard-translation${reveal.translation ? "" : " translation-hidden"}`}
        onClick={reveal.translation ? undefined : onRevealTranslation}
        role={reveal.translation ? undefined : "button"}
        tabIndex={reveal.translation ? undefined : 0}
        onKeyDown={
          reveal.translation
            ? undefined
            : (e) => { if (e.key === "Enter" || e.key === " ") onRevealTranslation(); }
        }
        aria-label={reveal.translation ? undefined : revealInstruction}
      >
        {reveal.translation ? (
          sentence.translation
        ) : (
          <>
            <span className="translation-hidden-text" aria-hidden="true">{sentence.translation}</span>
            <span className="translation-reveal-prompt">{revealInstruction}</span>
          </>
        )}
      </div>

      {/* Selected item details */}
      {selectedItem ? <StudyDetailsPanel item={selectedItem} /> : null}

      {/* Related sentences */}
      <RelatedSentences
        currentSentence={sentence}
        allSentences={allSentences}
        selectedItem={selectedItem}
      />

      {!reviewMode ? (
        <div className="grade-row">
          {GRADES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`button secondary grade-btn grade-${id}${currentGrade === id ? " active" : ""}`}
              onClick={() => onGrade(id)}
            >
              {label}
            </button>
          ))}
          <div className="grade-row-spacer" />
          <button
            type="button"
            className={`button secondary random-order-toggle${randomOrderEnabled ? " active" : ""}`}
            onClick={onToggleRandomOrder}
            aria-pressed={randomOrderEnabled}
            title={randomOrderEnabled ? "Random order on" : "Random order off"}
          >
            Random order {randomOrderEnabled ? "On" : "Off"}
          </button>
        </div>
      ) : null}

      {reviewMode ? (
        <div className="review-decision-row" aria-busy={isSavingReview}>
          <button
            type="button"
            className={`button review-negative${reviewState === "forgotten" ? " review-selected" : ""}`}
            onClick={() => onReview("forgotten")}
            title="Not remembered  ·  ←"
          >
            ← Not remembered
          </button>
          <button
            type="button"
            className={`button review-positive${reviewState === "remembered" ? " review-selected" : ""}`}
            onClick={() => onReview("remembered")}
            title="Remembered  ·  →"
          >
            Remembered →
          </button>
          {reviewError ? <p className="review-error">{reviewError}</p> : null}
        </div>
      ) : null}

      {!reviewMode ? (
        <div className="row">
          <button
            type="button"
            className="button secondary"
            disabled={cardIndex === 0}
            onClick={onPrev}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="button"
            onClick={onNext}
          >
            {cardIndex >= totalCards - 1 ? "Finish →" : "Next →"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
