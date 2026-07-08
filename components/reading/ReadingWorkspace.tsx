import { useState } from "react";
import { LessonReader } from "./LessonReader";
import { TextAnalyzer } from "./TextAnalyzer";

type ReadingView = "lessons" | "analyzer";

// Reading Mode shell: "Read lessons" is the primary view (sentence-by-sentence
// lesson reader); "Analyze text" is the paste-in coverage workbench. Both are
// strictly read-only with respect to review scheduling.
export function ReadingWorkspace() {
  const [view, setView] = useState<ReadingView>("lessons");

  return (
    <section className="reading-workspace">
      <div className="topbar">
        <div className="stack">
          <span className="pill pill-accent">Reading</span>
          <h1>Reading</h1>
          <p className="muted">Read imported lessons in full, or analyze outside text against what you know.</p>
        </div>
        <div className="reading-view-tabs" role="tablist" aria-label="Reading views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "lessons"}
            className={`button${view === "lessons" ? "" : " secondary"}`}
            onClick={() => setView("lessons")}
          >
            Read lessons
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "analyzer"}
            className={`button${view === "analyzer" ? "" : " secondary"}`}
            onClick={() => setView("analyzer")}
          >
            Analyze text
          </button>
        </div>
      </div>

      {view === "lessons" ? <LessonReader /> : <TextAnalyzer />}
    </section>
  );
}
