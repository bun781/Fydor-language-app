import { useMemo } from "react";
import type { SelectedItem, StudySentence } from "@/lib/imported-content/types";
import { findRelatedSentences } from "@/lib/imported-content/study-utils";

interface Props {
  currentSentence: StudySentence;
  allSentences: StudySentence[];
  selectedItem: SelectedItem | null;
}

export function RelatedSentences({ currentSentence, allSentences, selectedItem }: Props) {
  const related = useMemo(
    () => findRelatedSentences(currentSentence, allSentences, selectedItem),
    [currentSentence, allSentences, selectedItem]
  );

  if (!related.length) return null;

  return (
    <div className="related-sentences stack">
      <h3>Related sentences</h3>
      {related.map(({ sentence, reason }) => (
        <div key={sentence.id} className="related-sentence">
          <p className="related-sentence-text">{sentence.text}</p>
          {sentence.translation ? <p className="muted">{sentence.translation}</p> : null}
          <span className="related-reason muted">{reason}</span>
        </div>
      ))}
    </div>
  );
}
