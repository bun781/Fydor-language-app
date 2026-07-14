import { Archive, BookOpen, Download, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatLanguageLabel } from "@/lib/language/importResources";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { StudyPackMeta } from "@/lib/imported-content/types";

interface LessonLibraryPanelProps {
  lessons: StudyLessonMeta[];
  packs: StudyPackMeta[];
  loading: boolean;
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onNewLesson: () => void;
  onEditLesson: (lessonId: string) => void;
  onExportLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onConvertLesson: (lessonId: string) => void;
  onMoveLessons: (lessonIds: string[], packId: string) => Promise<void>;
  onCreatePack: (title: string) => Promise<void>;
  onRenamePack: (packId: string, title: string) => Promise<void>;
  onArchivePack: (packId: string, archived: boolean) => Promise<void>;
  onDeletePack: (packId: string) => Promise<void>;
}

export function LessonLibraryPanel({
  lessons,
  packs,
  loading,
  selectedLessonId,
  onSelectLesson,
  onNewLesson,
  onEditLesson,
  onExportLesson,
  onDeleteLesson,
  onConvertLesson
  ,onMoveLessons
  ,onCreatePack
  ,onRenamePack
  ,onArchivePack
  ,onDeletePack
}: LessonLibraryPanelProps) {
  const [selectedPackId, setSelectedPackId] = useState<string>("all");
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [moveTargetPackId, setMoveTargetPackId] = useState("");
  const visibleLessons = selectedPackId === "all"
    ? lessons
    : lessons.filter((lesson) => lesson.packId === selectedPackId);
  const selectedLesson = visibleLessons.find((lesson) => lesson.id === selectedLessonId)
    ?? lessons.find((lesson) => lesson.id === selectedLessonId)
    ?? null;

  async function createPack() {
    const title = window.prompt("New pack name");
    if (title?.trim()) await onCreatePack(title.trim());
  }

  async function renameSelectedPack() {
    const pack = packs.find((item) => item.id === selectedPackId);
    if (!pack) return;
    const title = window.prompt("Pack name", pack.title);
    if (title?.trim()) await onRenamePack(pack.id, title.trim());
  }

  async function deleteSelectedPack() {
    const pack = packs.find((item) => item.id === selectedPackId);
    if (!pack || pack.id === "personal-unsorted" || !window.confirm(`Move its lessons to Personal / Unsorted and delete ${pack.title}?`)) return;
    await onDeletePack(pack.id);
    setSelectedPackId("all");
  }

  return (
    <section className="lesson-library-shell stack">
      <div className="row lesson-library-header">
        <div>
          <h2>Lessons</h2>
          <p className="muted">Pick a lesson to export, delete, or open it in the editor for deeper changes.</p>
        </div>
        <button className="button secondary" type="button" data-tour="lesson-library-new" onClick={onNewLesson}>
          <Plus size={18} />
          New lesson
        </button>
      </div>

      <div className="lesson-library-grid">
        <section className="card stack lesson-library-list" data-tour="lesson-library-list">
          <div className="row">
            <h3>Saved lessons</h3>
            <span className="pill">{lessons.length}</span>
          </div>

          <div className="lesson-pack-actions">
            <button className="button secondary compact-button" type="button" onClick={() => void createPack()}><Plus size={15} /> New pack</button>
            {selectedPackId !== "all" && selectedPackId !== "personal-unsorted" ? <>
              <button className="button secondary compact-button" type="button" onClick={() => void renameSelectedPack()}>Rename</button>
              <button className="button secondary compact-button" type="button" onClick={() => void onArchivePack(selectedPackId, !packs.find((pack) => pack.id === selectedPackId)?.archived)}><Archive size={15} /> {packs.find((pack) => pack.id === selectedPackId)?.archived ? "Restore" : "Archive"}</button>
              <button className="button danger compact-button" type="button" onClick={() => void deleteSelectedPack()}>Delete pack</button>
            </> : null}
          </div>

          <div className="lesson-pack-filter" aria-label="Lesson packs">
            <button className={selectedPackId === "all" ? "active" : ""} type="button" onClick={() => setSelectedPackId("all")}>All packs</button>
            {packs.map((pack) => (
              <button className={selectedPackId === pack.id ? "active" : ""} type="button" key={pack.id} onClick={() => setSelectedPackId(pack.id)}>
                {pack.title}<span>{pack.lessonCount}</span>
              </button>
            ))}
          </div>

          {loading ? <p className="muted">Loading lessons…</p> : null}
          {!loading && visibleLessons.length === 0 ? (
            <p className="muted">No lessons saved yet. Create one in the builder or import a JSON file.</p>
          ) : null}

          <div className="lesson-library-items">
            {visibleLessons.map((lesson) => (
              <div
                className={`lesson-library-item${lesson.id === selectedLessonId ? " active" : ""}`}
                key={lesson.id}
              >
                <input type="checkbox" checked={selectedLessonIds.has(lesson.id)} aria-label={`Select ${lesson.title}`} onChange={() => setSelectedLessonIds((current) => {
                  const next = new Set(current);
                  if (next.has(lesson.id)) next.delete(lesson.id); else next.add(lesson.id);
                  return next;
                })} />
                <button className="lesson-library-item-content" type="button" onClick={() => onSelectLesson(lesson.id)}>
                <div className="lesson-library-item-top">
                  <strong>{lesson.title}</strong>
                  <span className="pill">{lesson.sentenceCount} sentences</span>
                </div>
                <span className="pill pill-accent">{lesson.packTitle ?? "Personal / Unsorted"}</span>
                <p className="muted">{formatLanguageLabel(lesson.language)} to {formatLanguageLabel(lesson.baseLanguage)}</p>
                {lesson.level ? <p className="muted">Level: {lesson.level}</p> : null}
                </button>
              </div>
            ))}
          </div>
          {selectedLessonIds.size ? <div className="lesson-bulk-actions">
            <strong>{selectedLessonIds.size} selected</strong>
            <select className="input selector-compact" value={moveTargetPackId} onChange={(event) => setMoveTargetPackId(event.target.value)} aria-label="Move selected lessons to pack">
              <option value="">Move to pack…</option>
              {packs.filter((pack) => pack.id !== selectedPackId && !pack.archived).map((pack) => <option key={pack.id} value={pack.id}>{pack.title}</option>)}
            </select>
            <button className="button secondary compact-button" type="button" disabled={!moveTargetPackId} onClick={async () => { await onMoveLessons([...selectedLessonIds], moveTargetPackId); setSelectedLessonIds(new Set()); setMoveTargetPackId(""); }}>Move</button>
            <button className="button secondary compact-button" type="button" onClick={() => setSelectedLessonIds(new Set())}>Clear</button>
          </div> : null}
        </section>

        <section className="card stack lesson-library-detail">
          {selectedLesson ? (
            <>
              <div className="row">
                <div>
                  <h3>{selectedLesson.title}</h3>
                  <p className="muted">
                    {formatLanguageLabel(selectedLesson.language)} to {formatLanguageLabel(selectedLesson.baseLanguage)}
                  </p>
                </div>
                <span className="pill">{selectedLesson.sentenceCount} sentences</span>
              </div>

              <div className="notice">
                <strong>{selectedLesson.publishedStableId ? "Published lesson installed locally" : "Private personal lesson"}</strong>
                <p className="muted">Saving here updates only your local study copy. It never submits or publishes content.</p>
              </div>

              {selectedLesson.description ? <p>{selectedLesson.description}</p> : <p className="muted">No description yet.</p>}
              {selectedLesson.level ? <p className="muted">Level: {selectedLesson.level}</p> : null}
              {selectedLesson.tags.length ? <p className="muted">Tags: {selectedLesson.tags.join(", ")}</p> : null}

              <div className="lesson-library-actions" data-tour="lesson-library-actions">
                <button className="button" type="button" onClick={() => onEditLesson(selectedLesson.id)}>
                  <BookOpen size={18} />
                  Open in editor
                </button>
                <button className="button secondary" type="button" onClick={() => onExportLesson(selectedLesson.id)}>
                  <Download size={18} />
                  Export JSON
                </button>
                <button className="button secondary" type="button" onClick={() => onConvertLesson(selectedLesson.id)}>
                  <Send size={18} />
                  Convert to contributor draft
                </button>
                <button className="button danger lesson-delete-button" type="button" onClick={() => onDeleteLesson(selectedLesson.id)}>
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>

              <p className="muted">
                Open the lesson in the builder to rename it, change the metadata, or modify its sentences and annotations.
              </p>
            </>
          ) : (
            <div className="lesson-library-empty">
              <h3>Select a lesson</h3>
              <p className="muted">Choose a lesson on the left to preview it here.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
