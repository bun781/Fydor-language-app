"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import type { ImportPreviewResult } from "@/lib/language/types";
import { InteractiveSentence } from "@/components/language/InteractiveSentence";

interface ImportPreviewProps {
  preview: ImportPreviewResult;
  importing: boolean;
  onApprove: () => void;
  onCancel: () => void;
}

export function ImportPreview({ preview, importing, onApprove, onCancel }: ImportPreviewProps) {
  const blocked = preview.duplicateImport ||
    preview.sentences.some((sentence) => sentence.duplicateSentence) ||
    preview.learningItems.some((item) => item.status === "conflict");

  return (
    <div className="stack">
      <section className="card stack">
        <div className="row">
          <div>
            <h2>{preview.lesson.title}</h2>
            <p className="muted">{preview.lesson.baseLanguage.toUpperCase()} to {preview.lesson.targetLanguage.toUpperCase()}</p>
          </div>
          <span className="pill">{preview.lesson.level ?? "Lesson"}</span>
        </div>
        {preview.duplicateImport ? <StatusMessage tone="warn" text="This lesson has already been imported." /> : null}
        {preview.warnings.length ? (
          <div className="notice-list">
            {preview.warnings.map((warning, index) => (
              <StatusMessage key={`${warning.code}-${index}`} tone="warn" text={warning.message} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid grid-2">
        <div className="card stack">
          <h2>Detected Items</h2>
          {preview.learningItems.length ? preview.learningItems.map((item) => (
            <div className="item-row" key={item.canonicalKey}>
              <div>
                <strong>{item.displayText}</strong>
                <p className="muted">{item.canonicalKey}</p>
              </div>
              <span className={`pill status-${item.status}`}>{item.status}</span>
            </div>
          )) : <p className="muted">No learning items detected.</p>}
        </div>

        <div className="card stack">
          <h2>Drills</h2>
          <p className="muted">{preview.sentences.reduce((count, sentence) => count + sentence.drills.length, 0)} Sentence Forge drills will be created.</p>
          <div className="row">
            <button className="button secondary" type="button" onClick={onCancel}>
              <X size={18} />
              Cancel
            </button>
            <button className="button" type="button" disabled={blocked || importing} onClick={onApprove}>
              <Check size={18} />
              {importing ? "Saving" : "Approve"}
            </button>
          </div>
        </div>
      </section>

      <section className="stack">
        {preview.sentences.map((sentence) => (
          <article className="card stack" key={`${sentence.index}-${sentence.text}`}>
            <div className="row">
              <span className="pill">Sentence {sentence.index + 1}</span>
              {sentence.duplicateSentence ? <span className="pill status-conflict">duplicate</span> : null}
            </div>
            <InteractiveSentence sentence={sentence.text} tokens={sentence.tokens} />
            <p className="muted">{sentence.translation}</p>
            {sentence.focus ? (
              <p>
                <strong>{sentence.focus.displayText}</strong>
                {sentence.focus.meaning ? `: ${sentence.focus.meaning}` : ""}
              </p>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}

function StatusMessage({ text, tone }: { text: string; tone: "warn" }) {
  return (
    <div className={`notice ${tone}`}>
      <AlertTriangle size={16} />
      <span>{text}</span>
    </div>
  );
}
