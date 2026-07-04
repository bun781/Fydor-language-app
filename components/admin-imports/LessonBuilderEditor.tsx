"use client";

import { Check, Highlighter, Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LessonImportInput, LessonSentenceInput } from "@/lib/language/types";
import { getCharAnnotationClassName } from "./lesson-import-utils";
import type { AnnotationDraft, SelectedSpan } from "./lesson-import-utils";

type AnnotationKind = AnnotationDraft["kind"];

export interface ActiveAnnotation {
  kind: AnnotationKind;
  index: number;
  label: string;
  detail?: string;
}

interface LessonBuilderEditorProps {
  lesson: LessonImportInput;
  activeSentence: LessonSentenceInput;
  activeSentenceIndex: number;
  selection: SelectedSpan | null;
  draft: AnnotationDraft;
  activeAnnotations: ActiveAnnotation[];
  setDraft: Dispatch<SetStateAction<AnnotationDraft>>;
  onUpdateSentence: (field: keyof LessonSentenceInput, value: string) => void;
  onAddSentence: (afterIndex?: number) => void;
  onRemoveSentence: (index: number) => void;
  onCaptureSelection: () => void;
  onSelectSentence: (index: number) => void;
  onAddAnnotation: () => void;
  onRemoveAnnotation: (kind: AnnotationKind, index: number) => void;
}

export function LessonBuilderEditor({
  lesson,
  activeSentence,
  activeSentenceIndex,
  selection,
  draft,
  activeAnnotations,
  setDraft,
  onUpdateSentence,
  onAddSentence,
  onRemoveSentence,
  onCaptureSelection,
  onSelectSentence,
  onAddAnnotation,
  onRemoveAnnotation
}: LessonBuilderEditorProps) {
  return (
    <div className="lesson-builder">
      <section className="builder-layout">
        <div className="stack">
          <section className="card stack">
            <div className="row">
              <div>
                <h2>Sentence {activeSentenceIndex + 1}</h2>
                {selection && <p className="muted">Selected: <strong>{selection.surface}</strong></p>}
              </div>
              <Tooltip content="Remove this sentence.">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Remove sentence"
                  disabled={lesson.sentences.length === 1}
                  onClick={() => onRemoveSentence(activeSentenceIndex)}
                >
                  <Trash2 size={18} />
                </button>
              </Tooltip>
              <Tooltip content="Add a sentence after this one.">
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Add sentence after this one"
                  onClick={() => onAddSentence(activeSentenceIndex)}
                >
                  <Plus size={18} />
                </button>
              </Tooltip>
            </div>
            <div className="selectable-sentence" onMouseUp={onCaptureSelection} onKeyUp={onCaptureSelection}>
              {activeSentence.text ? (
                Array.from(activeSentence.text).map((char, index) => {
                  const annotationClassName = getCharAnnotationClassName(activeSentence, char, index);
                  return (
                    <span
                      data-char-index={index}
                      key={`${char}-${index}`}
                      className={annotationClassName}
                    >
                      {char}
                    </span>
                  );
                })
              ) : (
                <span className="sentence-placeholder">Type a sentence below…</span>
              )}
            </div>
            <label className="field">
              <span>Text</span>
              <textarea className="input sentence-input" value={activeSentence.text} onChange={(event) => onUpdateSentence("text", event.target.value)} />
            </label>
            <label className="field">
              <span>Translation</span>
              <input className="input" value={activeSentence.translation ?? ""} onChange={(event) => onUpdateSentence("translation", event.target.value)} />
            </label>
          </section>

          <section className="card stack">
            <div className="row">
              <h2>Sentences</h2>
              <button
                className="button secondary"
                type="button"
                title="Add a new sentence after the active one"
                onClick={() => onAddSentence()}
              >
                <Plus size={18} />
                Add sentence
              </button>
            </div>
            <div className="sentence-tabs">
              {lesson.sentences.map((sentence, index) => (
                <button
                  className={index === activeSentenceIndex ? "active" : ""}
                  key={index}
                  type="button"
                  onClick={() => onSelectSentence(index)}
                >
                  <span>{index + 1}</span>
                  {sentence.text || "Untitled sentence"}
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="card stack">
            <div className="row">
              <h2>Annotate</h2>
              <Highlighter size={18} />
            </div>
            <div className="annotation-types">
              {(["word", "grammar", "chunk"] as AnnotationKind[]).map((kind) => (
                <button
                  className={`kind-${kind}${draft.kind === kind ? " active" : ""}`}
                  key={kind}
                  type="button"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    kind,
                    pattern: kind === "grammar" && !current.pattern ? current.surface : current.pattern
                  }))}
                >
                  {kind}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Surface</span>
              <input className="input" value={draft.surface} onChange={(event) => setDraft({ ...draft, surface: event.target.value })} />
            </label>
            {draft.kind === "word" ? (
              <>
                <label className="field">
                  <span>Lemma</span>
                  <input className="input" value={draft.lemma} onChange={(event) => setDraft({ ...draft, lemma: event.target.value })} />
                </label>
                <label className="field">
                  <span>Role</span>
                  <input className="input" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} />
                </label>
              </>
            ) : null}
            {draft.kind === "grammar" ? (
              <label className="field">
                <span>Pattern</span>
                <input className="input" value={draft.pattern} onChange={(event) => setDraft({ ...draft, pattern: event.target.value })} />
              </label>
            ) : null}
            {draft.kind === "chunk" ? (
              <>
                <label className="field">
                  <span>Type</span>
                  <input className="input" value={draft.chunkType} onChange={(event) => setDraft({ ...draft, chunkType: event.target.value })} />
                </label>
                <label className="field">
                  <span>Tags</span>
                  <input className="input" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
                </label>
              </>
            ) : null}
            <label className="field">
              <span>Meaning</span>
              <input className="input" value={draft.meaning} onChange={(event) => setDraft({ ...draft, meaning: event.target.value })} />
            </label>
            <label className="field">
              <span>Explanation</span>
              <textarea className="input small-textarea" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} />
            </label>
            <button className={`button kind-${draft.kind}`} type="button" onClick={onAddAnnotation}>
              <Check size={18} />
              Add annotation
            </button>
          </section>

          <section className="card stack">
            <h2>Current Notes</h2>
            {activeAnnotations.length ? (
              <div className="annotation-list">
                {activeAnnotations.map((annotation) => (
                  <div className="annotation-row" key={`${annotation.kind}-${annotation.index}-${annotation.label}`}>
                    <div>
                      <span className={`pill pill-${annotation.kind}`}>{annotation.kind}</span>
                      <strong>{annotation.label}</strong>
                      {annotation.detail ? <p className="muted">{annotation.detail}</p> : null}
                    </div>
                    <Tooltip content="Remove this annotation.">
                      <button className="icon-button" type="button" aria-label="Remove annotation" onClick={() => onRemoveAnnotation(annotation.kind, annotation.index)}>
                        <Trash2 size={17} />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : <p className="muted">No annotations yet.</p>}
          </section>
        </aside>
      </section>
    </div>
  );
}
