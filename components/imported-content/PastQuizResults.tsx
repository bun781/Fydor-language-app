import type { SavedTestResult } from "./quizSession";

export function PastQuizResults({
  emptyMessage,
  results
}: {
  emptyMessage: string;
  results: SavedTestResult[];
}) {
  if (!results.length) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="past-results stack">
      {results.map((result) => (
        <div className="past-result-row" key={result.id}>
          <div>
            <strong>{result.correct}/{result.questionCount}</strong>
            <p className="muted">{result.lessonTitles.join(", ") || "Selected lessons"}</p>
          </div>
          <span className="pill">{result.mode === "continuous" ? "Continuous" : "Full test"}</span>
          <small>{new Date(result.completedAt).toLocaleString()}</small>
        </div>
      ))}
    </div>
  );
}
