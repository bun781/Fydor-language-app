import type { ReactNode } from "react";
import { AudioButton } from "@/components/ui/AudioButton";
import { getFillBlankPrompt, getRecallModeLabel } from "@/lib/review/recallModes";
import type { ReviewSentence } from "@/lib/review/types";

const itemTypeLabels: Record<NonNullable<ReviewSentence["itemType"]>, string> = {
  word: "Word focus",
  grammar: "Grammar focus",
  chunk: "Chunk focus"
};

interface ReviewSentenceCardProps {
  sentence: ReviewSentence;
  index: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
}

export function ReviewSentenceCard({ sentence, index, total, revealed, onReveal }: ReviewSentenceCardProps) {
  const revealInstruction = "Recall first, then click or press Space to reveal";
  const recallMode = sentence.recallMode ?? "full_support";
  const blank = recallMode === "fill_blank" ? getFillBlankPrompt(sentence.text, sentence.focusText) : null;
  const prompt = getPrompt(sentence, blank?.prompt);
  const showTargetBeforeReveal = recallMode !== "reverse_translate";
  const showTranslationBeforeReveal = recallMode === "full_support";
  const showAnnotationsBeforeReveal = recallMode === "full_support";

  return (
    <section className="review-card">
      <div className="review-card-meta">
        <span className="pill">Card {index + 1} of {total}</span>
        <span className={`pill review-state-${sentence.reviewState}`}>{sentence.reviewState}</span>
        {sentence.itemType ? <span className="pill pill-accent">{itemTypeLabels[sentence.itemType]}</span> : null}
        <span className="pill">{getRecallModeLabel(recallMode)}</span>
      </div>
      {showTargetBeforeReveal || revealed ? (
        <div className="review-sentence-row">
          <p className="review-sentence">{renderTargetText(sentence, revealed ? sentence.text : prompt)}</p>
          <AudioButton sentence={sentence.text} language={sentence.language} compact />
        </div>
      ) : (
        <div className="review-reverse-prompt">
          <span className="muted">Produce the target sentence</span>
          <p>{sentence.translation}</p>
        </div>
      )}
      {showAnnotationsBeforeReveal && !revealed && hasFocus(sentence) ? (
        <div className="review-annotations">
          {sentence.focusText ? <span>{sentence.focusText}</span> : null}
          {sentence.focusMeaning ? <span>{sentence.focusMeaning}</span> : null}
          {sentence.focusExplanation ? <span>{sentence.focusExplanation}</span> : null}
        </div>
      ) : null}
      <div
        className={`review-translation-wrap${revealed ? " revealed" : ""}`}
        onClick={revealed ? undefined : onReveal}
        role={revealed ? undefined : "button"}
        tabIndex={revealed ? undefined : 0}
        onKeyDown={
          revealed
            ? undefined
            : (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onReveal();
                }
              }
        }
        aria-label={revealed ? undefined : revealInstruction}
      >
        <p className={`review-translation${revealed || showTranslationBeforeReveal ? "" : " review-translation-hidden"}`}>
          {revealed || showTranslationBeforeReveal ? sentence.translation : "Answer hidden"}
        </p>
        {!revealed ? <span className="review-translation-overlay">{revealInstruction}</span> : null}
      </div>
      {revealed && blank?.answer ? <p className="muted">Blank: {blank.answer}</p> : null}
      <div className="review-stats">
        <span>Repetitions {sentence.repetitions ?? sentence.reviewStreak}</span>
        <span>Lapses {sentence.lapses ?? 0}</span>
        <span>{sentence.lastReviewedAt ? `Last reviewed ${new Date(sentence.lastReviewedAt).toLocaleString()}` : "Never reviewed"}</span>
      </div>
    </section>
  );
}

function getPrompt(sentence: ReviewSentence, fillBlankPrompt?: string): string {
  if ((sentence.recallMode ?? "full_support") === "fill_blank" && fillBlankPrompt) return fillBlankPrompt;
  return sentence.text;
}

// Item targets are reviewed through an example sentence; highlight the item's surface
// form so the learner knows which part of the sentence is being tested. Sentence
// targets render as plain text, exactly as before.
function renderTargetText(sentence: ReviewSentence, text: string): ReactNode {
  const surface = sentence.itemType ? sentence.focusText : null;
  if (!surface) return text;
  const index = text.indexOf(surface);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="review-item-focus">{surface}</mark>
      {text.slice(index + surface.length)}
    </>
  );
}

function hasFocus(sentence: ReviewSentence): boolean {
  return Boolean(sentence.focusText || sentence.focusMeaning || sentence.focusExplanation);
}
