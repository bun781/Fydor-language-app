"use client";

import { BookOpen, Download, Plus, Trash2 } from "lucide-react";
import { formatLanguageLabel } from "@/lib/language/importResources";
import type { StudyLessonMeta } from "@/lib/imported-content/types";

interface LessonLibraryPanelProps {
  lessons: StudyLessonMeta[];
  loading: boolean;
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onNewLesson: () => void;
  onEditLesson: (lessonId: string) => void;
  onExportLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
}

export function LessonLibraryPanel({
  lessons,
  loading,
  selectedLessonId,
  onSelectLesson,
  onNewLesson,
  onEditLesson,
  onExportLesson,
  onDeleteLesson
}: LessonLibraryPanelProps) {
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

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

          {loading ? <p className="muted">Loading lessons…</p> : null}
          {!loading && lessons.length === 0 ? (
            <p className="muted">No lessons saved yet. Create one in the builder or import a JSON file.</p>
          ) : null}

          <div className="lesson-library-items">
            {lessons.map((lesson) => (
              <button
                className={`lesson-library-item${lesson.id === selectedLessonId ? " active" : ""}`}
                key={lesson.id}
                type="button"
                onClick={() => onSelectLesson(lesson.id)}
              >
                <div className="lesson-library-item-top">
                  <strong>{lesson.title}</strong>
                  <span className="pill">{lesson.sentenceCount} sentences</span>
                </div>
                <p className="muted">{formatLanguageLabel(lesson.language)} to {formatLanguageLabel(lesson.baseLanguage)}</p>
                {lesson.level ? <p className="muted">Level: {lesson.level}</p> : null}
              </button>
            ))}
          </div>
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
