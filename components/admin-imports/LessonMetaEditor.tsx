// Presentational pieces of the Lesson Manager top card: lesson metadata fields
// (title, languages, level/source, description, tags, import target) and the
// append-sentence-JSON panel. All state lives in LessonImportsPage.
import type { KeyboardEvent } from "react";
import { LanguageField } from "@/components/admin-imports/LanguageField";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportInput } from "@/lib/language/types";

export function LessonMetaEditor({
  lesson,
  lessonOptions,
  lessonsLoading,
  targetLessonId,
  editingExistingLesson,
  targetLesson,
  onFieldChange,
  onRemoveTag,
  onTagKeyDown,
  onAddTag,
  onTargetLessonChange
}: {
  lesson: LessonImportInput;
  lessonOptions: StudyLessonMeta[];
  lessonsLoading: boolean;
  targetLessonId: string;
  editingExistingLesson: boolean;
  targetLesson: StudyLessonMeta | undefined;
  onFieldChange: (field: "title" | "language" | "baseLanguage" | "level" | "source" | "description", value: string) => void;
  onRemoveTag: (tag: string) => void;
  onTagKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onAddTag: (value: string) => void;
  onTargetLessonChange: (lessonId: string) => void;
}) {
  return (
    <div className="lesson-meta-compact">
      <div className="lesson-title-block">
        <input
          className="lesson-title-input"
          value={lesson.title}
          placeholder="Lesson title"
          aria-label="Lesson title"
          onChange={(event) => onFieldChange("title", event.target.value)}
        />
        <span className="lesson-sentence-count">
          {lesson.sentences.length} sentence{lesson.sentences.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="lesson-meta-inline" aria-label="Lesson metadata">
        <LanguageField
          label="Language"
          value={lesson.language}
          className="compact-language-field"
          inputClassName="input compact-meta-input"
          onChange={(value) => onFieldChange("language", value)}
        />
        <span className="meta-separator" aria-hidden="true">→</span>
        <LanguageField
          label="Base"
          value={lesson.baseLanguage}
          className="compact-language-field"
          inputClassName="input compact-meta-input"
          onChange={(value) => onFieldChange("baseLanguage", value)}
        />
        <span className="meta-separator" aria-hidden="true">.</span>
        <label className="field compact-field">
          <span>Level</span>
          <input
            className="input compact-meta-input"
            value={lesson.level ?? ""}
            placeholder="Level"
            onChange={(event) => onFieldChange("level", event.target.value)}
          />
        </label>
        <span className="meta-separator" aria-hidden="true">.</span>
        <label className="field compact-field">
          <span>Source</span>
          <input
            className="input compact-meta-input"
            value={lesson.source ?? ""}
            placeholder="Source"
            onChange={(event) => onFieldChange("source", event.target.value)}
          />
        </label>
      </div>

      <input
        className="input compact-description-input"
        value={lesson.description ?? ""}
        placeholder="Description"
        aria-label="Description"
        onChange={(event) => onFieldChange("description", event.target.value)}
      />

      <div className="lesson-meta-footer">
        <div className="tag-editor" aria-label="Lesson tags">
          {(lesson.tags ?? []).map((tag) => (
            <button className="tag-chip" key={tag} type="button" title={`Remove ${tag}`} aria-label={`Remove tag ${tag}`} onClick={() => onRemoveTag(tag)}>
              {tag}
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <input
            className="tag-input"
            placeholder={(lesson.tags ?? []).length ? "Add tag" : "Add tags"}
            aria-label="Add lesson tag"
            onKeyDown={onTagKeyDown}
            onBlur={(event) => {
              onAddTag(event.currentTarget.value);
              event.currentTarget.value = "";
            }}
          />
        </div>

        <div className="lesson-target-compact">
          <span>Target:</span>
          {editingExistingLesson ? (
            <strong>Current lesson</strong>
          ) : (
            <select
              className="compact-target-select"
              disabled={lessonsLoading}
              value={targetLessonId}
              aria-label="Import target"
              onChange={(event) => onTargetLessonChange(event.target.value)}
            >
              <option value="new">New lesson</option>
              {lessonOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.language})
                </option>
              ))}
            </select>
          )}
          <small>{editingExistingLesson ? "Updates in place" : targetLesson ? "Appends sentences" : "Creates a lesson"}</small>
        </div>
      </div>
    </div>
  );
}

export function AppendJsonPanel({
  appendSource,
  placeholder,
  onChange,
  onClear
}: {
  appendSource: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="append-json-panel stack">
      <div className="row">
        <div>
          <h2>Append Sentence JSON</h2>
          <p className="muted">Paste here to append to the selected lesson instead of updating the full lesson.</p>
        </div>
        <button className="button secondary compact-button" type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <textarea
        className="input code-input append-json-input"
        value={appendSource}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Append sentence JSON"
      />
    </section>
  );
}
