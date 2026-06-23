"use client";

import { useId } from "react";
import type { StudySentence } from "@/lib/imported-content/types";
import { buildAnnotationRanges, type AnnotationRange } from "@/lib/imported-content/text-spans";

type Run =
  | { kind: "plain"; text: string }
  | { kind: "annotated"; text: string; annotations: AnnotationRange[] };

const KIND_ORDER: Record<AnnotationRange["kind"], number> = { word: 0, grammar: 1, chunk: 2 };

function sameAnnotations(left: AnnotationRange[], right: AnnotationRange[]): boolean {
  return left.length === right.length && left.every((range, index) => range.id === right[index]?.id);
}

function annotationClassName(annotations: AnnotationRange[]): string {
  const kinds = new Set(annotations.map((annotation) => annotation.kind));
  return [
    "sentence-annotated",
    kinds.has("word") ? "annotated-has-word" : null,
    kinds.has("grammar") ? "annotated-has-grammar" : null,
    kinds.has("chunk") ? "annotated-has-chunk" : null
  ].filter(Boolean).join(" ");
}

export function buildAnnotatedSentenceRuns(sentence: StudySentence): Run[] {
  const { text } = sentence;
  const ranges = buildAnnotationRanges(sentence);

  const charMap: AnnotationRange[][] = Array.from({ length: text.length }, () => []);
  for (let i = 0; i < text.length; i++) {
    charMap[i] = ranges
      .filter((range) => i >= range.start && i < range.end)
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.start - b.start || a.id.localeCompare(b.id));
  }

  const runs: Run[] = [];
  let i = 0;
  while (i < text.length) {
    const annotations = charMap[i];
    if (!annotations.length) {
      let j = i;
      while (j < text.length && !charMap[j].length) j++;
      runs.push({ kind: "plain", text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && sameAnnotations(charMap[j], annotations)) j++;
      runs.push({ kind: "annotated", text: text.slice(i, j), annotations });
      i = j;
    }
  }

  return runs;
}

export function AnnotatedSentence({ sentence }: { sentence: StudySentence }) {
  const baseId = useId();
  const runs = buildAnnotatedSentenceRuns(sentence);
  const hasAnnotations = runs.some((r) => r.kind === "annotated");

  if (!hasAnnotations) {
    return <p className="sentence-text">{sentence.text}</p>;
  }

  return (
    <p className="sentence-text">
      {runs.map((run, i) => {
        if (run.kind === "plain") return <span key={i}>{run.text}</span>;

        const tipId = `${baseId}-t${i}`;
        return (
          <span key={i} className="tooltip-wrap tooltip-bottom sentence-annotated-wrap">
            <span className={annotationClassName(run.annotations)} aria-describedby={tipId}>
              {run.text}
            </span>
            <span className="tooltip-bubble" role="tooltip" id={tipId}>
              <span className="tooltip-stack">
                {run.annotations.map((annotation) => (
                  <span className="sentence-annotation-note" key={annotation.id}>
                    <strong>{annotation.displayText}</strong>
                    {annotation.meaning ? <span>{annotation.meaning}</span> : null}
                    {annotation.explanation ? <span className="muted">{annotation.explanation}</span> : null}
                  </span>
                ))}
              </span>
            </span>
          </span>
        );
      })}
    </p>
  );
}
