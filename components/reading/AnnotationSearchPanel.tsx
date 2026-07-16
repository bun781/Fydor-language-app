import { useEffect, useState } from "react";
import type { StudyLesson } from "@/lib/imported-content/types";
import { copyAnnotationToLesson, getLanguagePairs, searchAnnotations, type AnnotationSearchResult } from "@/lib/desktopApi";

export function AnnotationSearchPanel({ lesson, sentenceId, onCopied }: { lesson: StudyLesson; sentenceId: string; onCopied: () => void }) {
  const [pairId, setPairId] = useState<string>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnnotationSearchResult[]>([]);
  const [message, setMessage] = useState<string>();
  useEffect(() => { void getLanguagePairs().then((pairs) => setPairId(pairs.find((pair) => pair.targetLanguage === lesson.language && pair.baseLanguage === lesson.baseLanguage)?.id)); }, [lesson.baseLanguage, lesson.language]);
  async function search() {
    if (!pairId) return;
    setMessage(undefined);
    setResults(await searchAnnotations({ languagePairId: pairId, query }));
  }
  async function copy(result: AnnotationSearchResult) {
    try { await copyAnnotationToLesson(result.id, lesson.id, sentenceId); setMessage("Copied to this sentence."); onCopied(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Copy failed."); }
  }
  return <section className="card stack" aria-label="Annotation search">
    <div className="row"><strong>Annotation search</strong><span className="muted">{lesson.language} → {lesson.baseLanguage}</span></div>
    <div className="row"><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Word, grammar, or note" aria-label="Search annotations" /><button className="button secondary" type="button" disabled={!pairId} onClick={() => void search()}>Search</button></div>
    {message ? <p className="muted">{message}</p> : null}
    {results.map((result) => <div className="annotation-row" key={result.id}><div><span className={`pill pill-${result.itemType}`}>{result.itemType}</span> <strong>{result.surfaceText}</strong><p className="muted">{result.meaning ?? result.explanation ?? "No note"} · {result.sourceLessonTitle}</p></div><button className="button secondary" type="button" onClick={() => void copy(result)}>Copy here</button></div>)}
  </section>;
}
