import { Download, Globe2, RefreshCw, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { installPublishedLesson } from "@/lib/desktopApi";
import { downloadPublishedLesson, listPublishedLessons, type PublishedLessonSummary } from "@/lib/public-library";
import { errorMessage } from "@/lib/errors";

export function PublicLessonLibrary({ onInstalled }: { onInstalled: () => Promise<void> }) {
  const [lessons, setLessons] = useState<PublishedLessonSummary[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listPublishedLessons({ pageSize: 50 })
      .then((result) => {
        if (cancelled) return;
        setLessons(result.lessons);
        setStatus(result.lessons.length ? `${result.lessons.length} published lesson${result.lessons.length === 1 ? "" : "s"}.` : "No published lessons are available yet.");
      })
      .catch((cause) => { if (!cancelled) setError(errorMessage(cause, "Unable to reach the Fydor lesson library.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await listPublishedLessons({ q: query, language, level, pageSize: 50 });
      setLessons(result.lessons);
      setStatus(result.lessons.length ? `${result.lessons.length} published lesson${result.lessons.length === 1 ? "" : "s"}.` : "No published lessons match these filters.");
    } catch (cause) {
      setError(errorMessage(cause, "Unable to reach the Fydor lesson library."));
    } finally {
      setLoading(false);
    }
  }

  async function install(lesson: PublishedLessonSummary) {
    setInstallingId(lesson.id);
    setError("");
    setStatus("");
    try {
      const envelope = await downloadPublishedLesson(lesson.id);
      if (envelope.checksum !== lesson.checksum || envelope.manifest.checksum !== lesson.checksum) {
        throw new Error("The lesson metadata changed during download. Refresh the library and try again.");
      }
      const result = await installPublishedLesson({
        stableLessonId: lesson.id,
        lessonVersion: lesson.lessonVersion,
        checksum: envelope.checksum,
        source: JSON.stringify(envelope.lesson)
      });
      await onInstalled();
      const label = result.status === "already_installed" ? "Already installed" : result.status === "updated" ? "Lesson updated" : "Lesson installed";
      setStatus(`${label}: ${lesson.title}.${result.warning ? ` ${result.warning}` : ""}`);
    } catch (cause) {
      setError(errorMessage(cause, "Unable to install this published lesson."));
    } finally {
      setInstallingId(null);
    }
  }

  return (
    <section className="card stack exchange-section exchange-public-library" data-tour="exchange-public-library">
      <div className="exchange-section-heading">
        <Globe2 size={20} />
        <div>
          <h2>Published Lesson Library</h2>
          <p className="muted">Browse administrator-published lessons. Every download is checksum-verified and validated again before local import.</p>
        </div>
      </div>
      <div className="exchange-filter-row">
        <label className="exchange-search"><Search size={16} /><input value={query} placeholder="Search lessons" aria-label="Search published lessons" onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} /></label>
        <label className="exchange-select-filter"><span className="sr-only">Target language</span><input className="input public-library-filter" value={language} placeholder="Language code" onChange={(event) => setLanguage(event.target.value)} /></label>
        <label className="exchange-select-filter"><span className="sr-only">Level</span><input className="input public-library-filter" value={level} placeholder="Level" onChange={(event) => setLevel(event.target.value)} /></label>
        <button className="button secondary" type="button" disabled={loading} onClick={() => void load()}><RefreshCw size={16} />{loading ? "Loading…" : "Search"}</button>
      </div>
      {error ? <div className="notice error-card" role="alert">{error}</div> : null}
      {status ? <p className="muted">{status}</p> : null}
      <div className="public-lesson-grid">
        {lessons.map((lesson) => (
          <article className="exchange-pack-row" key={lesson.id}>
            <div className="exchange-pack-row-top"><div><h3>{lesson.title}</h3><p className="muted">{lesson.description}</p></div><span className="pill status-new">Published</span></div>
            <div className="exchange-stat-row"><span>{lesson.targetLanguage} → {lesson.baseLanguage}</span><span>{lesson.level}</span><span>{lesson.sentenceCount} sentences</span><span>v{lesson.lessonVersion}</span><span>{lesson.license}</span></div>
            {lesson.tags.length ? <div className="inline-tags">{lesson.tags.map((tag) => <span className="tag-chip static" key={tag}>{tag}</span>)}</div> : null}
            <p className="published-checksum" title={lesson.checksum}>SHA-256 {lesson.checksum}</p>
            <button className="button" type="button" disabled={installingId !== null} onClick={() => void install(lesson)}><Download size={17} />{installingId === lesson.id ? "Verifying and installing…" : "Download and install"}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
