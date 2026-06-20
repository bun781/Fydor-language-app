"use client";

import { ArrowRight, Check, Eye, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { InteractiveSentence } from "@/components/language/InteractiveSentence";
import type { SentenceDrillType, SentenceGrade } from "@/lib/language/types";

interface ForgeItem {
  reviewStateId: string;
  drillId: string;
  drillType: SentenceDrillType;
  prompt: string;
  answer: string;
  payload: Record<string, unknown>;
  sentenceText: string;
  translation: string;
  focusDisplayText?: string | null;
  focusMeaning?: string | null;
  focusExplanation?: string | null;
  tokens: Array<{
    id: string;
    text: string;
    meaning?: string | null;
    explanation?: string | null;
    commonMistakes?: string[] | null;
    canonicalKey?: string | null;
    learningItemId?: string | null;
  }>;
}

interface SentenceForgeProps {
  initialItem: ForgeItem | null;
}

const steps = ["Example", "Recall", "Rebuild", "Cloze", "Transform", "Original", "Grade"];
const grades: SentenceGrade[] = ["failed", "hard", "correct", "easy"];

export function SentenceForge({ initialItem }: SentenceForgeProps) {
  const [item, setItem] = useState(initialItem);
  const [step, setStep] = useState(0);
  const [response, setResponse] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const shuffledTokens = useMemo(() => {
    const payloadTokens = item?.payload.tokens;
    return Array.isArray(payloadTokens) ? payloadTokens.map(String) : item?.tokens.map((token) => token.text) ?? [];
  }, [item]);

  if (!item) {
    return (
      <section className="card stack">
        <h2>Sentence Forge</h2>
        <p className="muted">No due drills.</p>
      </section>
    );
  }

  async function loadNext() {
    const result = await fetch("/api/study/sentence-forge", { cache: "no-store" });
    const data = await result.json() as { item: ForgeItem | null };
    setItem(data.item);
    setStep(0);
    setResponse("");
    setRevealed(false);
    setSelectedTokens([]);
  }

  async function submitGrade(grade: SentenceGrade) {
    if (!item) return;
    setMessage("Saving");
    const result = await fetch("/api/study/sentence-forge/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewStateId: item.reviewStateId,
        drillId: item.drillId,
        grade,
        response
      })
    });

    if (!result.ok) {
      const data = await result.json() as { error?: string };
      setMessage(data.error ?? "Unable to save grade.");
      return;
    }

    setMessage("Saved");
    await loadNext();
  }

  return (
    <section className="card forge-shell">
      <div className="row">
        <div>
          <h2>Sentence Forge</h2>
          <p className="muted">{steps[step]}</p>
        </div>
        <span className="pill">{step + 1} / {steps.length}</span>
      </div>

      <div className="step-tabs" aria-label="Sentence Forge steps">
        {steps.map((label, index) => (
          <button className={index === step ? "active" : ""} type="button" key={label} onClick={() => setStep(index)}>
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div className="stack">
          <InteractiveSentence sentence={item.sentenceText} tokens={item.tokens} />
          <p className="muted">{item.translation}</p>
          {item.focusDisplayText ? <p><strong>{item.focusDisplayText}</strong>{item.focusMeaning ? `: ${item.focusMeaning}` : ""}</p> : null}
          {item.focusExplanation ? <p className="muted">{item.focusExplanation}</p> : null}
        </div>
      ) : null}

      {step === 1 ? (
        <PracticeStep
          prompt="Translate into target language."
          answer={item.sentenceText}
          response={response}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onResponse={setResponse}
        />
      ) : null}

      {step === 2 ? (
        <div className="stack">
          <p>{item.translation}</p>
          <div className="token-bank">
            {shuffledTokens.map((token, index) => (
              <button type="button" className="button secondary" key={`${token}-${index}`} onClick={() => setSelectedTokens([...selectedTokens, token])}>
                {token}
              </button>
            ))}
          </div>
          <div className="rebuild-line">{selectedTokens.join("") || " "}</div>
          <button className="button secondary" type="button" onClick={() => setSelectedTokens([])}>
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <PracticeStep
          prompt={item.drillType === "cloze" ? item.prompt : makeCloze(item.sentenceText, item.focusDisplayText)}
          answer={item.drillType === "cloze" ? item.answer : item.focusDisplayText ?? item.answer}
          response={response}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onResponse={setResponse}
        />
      ) : null}

      {step === 4 ? (
        <PracticeStep
          prompt={item.drillType === "transformation" ? item.prompt : "Transform the sentence."}
          answer={item.drillType === "transformation" ? item.answer : item.sentenceText}
          response={response}
          revealed={revealed}
          onReveal={() => setRevealed(true)}
          onResponse={setResponse}
        />
      ) : null}

      {step === 5 ? (
        <div className="stack">
          <p>Use {item.focusDisplayText ?? "the focus item"}.</p>
          <textarea className="input" value={response} onChange={(event) => setResponse(event.target.value)} aria-label="Original sentence" />
        </div>
      ) : null}

      {step === 6 ? (
        <div className="stack">
          <p className="muted">{message || "Self grade this drill."}</p>
          <div className="grade-grid">
            {grades.map((grade) => (
              <button className="button secondary" type="button" key={grade} onClick={() => submitGrade(grade)}>
                <Check size={18} />
                {grade}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="row">
        <button className="button secondary" type="button" disabled={step === 0} onClick={() => {
          setStep(Math.max(0, step - 1));
          setRevealed(false);
        }}>
          Back
        </button>
        <button className="button" type="button" disabled={step === steps.length - 1} onClick={() => {
          setStep(Math.min(steps.length - 1, step + 1));
          setRevealed(false);
        }}>
          Next
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}

function PracticeStep({
  prompt,
  answer,
  response,
  revealed,
  onReveal,
  onResponse
}: {
  prompt: string;
  answer: string;
  response: string;
  revealed: boolean;
  onReveal: () => void;
  onResponse: (value: string) => void;
}) {
  return (
    <div className="stack">
      <p>{prompt}</p>
      <input className="input" value={response} onChange={(event) => onResponse(event.target.value)} aria-label="Drill response" />
      <button className="button secondary" type="button" onClick={onReveal}>
        <Eye size={18} />
        Reveal
      </button>
      {revealed ? <div className="answer-box">{answer}</div> : null}
    </div>
  );
}

function makeCloze(sentence: string, focus?: string | null): string {
  if (focus && sentence.includes(focus)) {
    return sentence.replace(focus, "____");
  }

  return `${sentence}\n____`;
}
