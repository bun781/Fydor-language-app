import type { SelectedItem } from "@/lib/imported-content/types";

interface Props {
  item: SelectedItem;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="detail-label">{label}</span>
      <p>{value}</p>
    </div>
  );
}

function MistakesList({ mistakes }: { mistakes: string[] }) {
  if (!mistakes.length) return null;
  return (
    <div>
      <span className="detail-label">Common mistakes</span>
      <ul className="detail-mistakes">
        {mistakes.map((m, i) => <li key={i} className="muted">{m}</li>)}
      </ul>
    </div>
  );
}

export function StudyDetailsPanel({ item }: Props) {
  return (
    <div className="details-panel stack">
      <div className="row">
        <span className={`pill pill-${item.kind}`}>{item.kind}</span>
      </div>

      {item.kind === "word" ? (
        <div className="stack">
          <p className="details-surface">{item.data.surface}</p>
          {item.data.displayText !== item.data.surface ? (
            <DetailRow label="Lemma" value={item.data.displayText} />
          ) : null}
          {item.data.meaning ? <DetailRow label="Meaning" value={item.data.meaning} /> : null}
          {item.data.explanation ? <DetailRow label="Explanation" value={item.data.explanation} /> : null}
          <MistakesList mistakes={item.data.commonMistakes} />
        </div>
      ) : null}

      {item.kind === "grammar" ? (
        <div className="stack">
          <p className="details-surface">{item.data.pattern}</p>
          {item.data.surfaceText !== item.data.pattern ? (
            <DetailRow label="Surface" value={item.data.surfaceText} />
          ) : null}
          {item.data.meaning ? <DetailRow label="Meaning" value={item.data.meaning} /> : null}
          {item.data.explanation ? <DetailRow label="Explanation" value={item.data.explanation} /> : null}
          <MistakesList mistakes={item.data.commonMistakes} />
        </div>
      ) : null}

      {item.kind === "chunk" ? (
        <div className="stack">
          <p className="details-surface">{item.data.surfaceText}</p>
          {item.data.meaning ? <DetailRow label="Meaning" value={item.data.meaning} /> : null}
          {item.data.explanation ? <DetailRow label="Usage" value={item.data.explanation} /> : null}
        </div>
      ) : null}
    </div>
  );
}
