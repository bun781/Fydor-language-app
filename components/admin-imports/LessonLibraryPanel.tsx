import {
  Archive,
  BookOpen,
  Box,
  Download,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { formatLanguageLabel } from "@/lib/language/importResources";
import type { StudyLessonMeta, StudyPackMeta, StudyPackUnitMeta } from "@/lib/imported-content/types";

interface LessonLibraryPanelProps {
  lessons: StudyLessonMeta[];
  packs: StudyPackMeta[];
  units: StudyPackUnitMeta[];
  loading: boolean;
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string) => void;
  onNewLesson: () => void;
  onEditLesson: (lessonId: string) => void;
  onExportLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onConvertLesson: (lessonId: string) => void;
  onMoveLessons: (lessonIds: string[], packId: string, unitId: string | null) => Promise<void>;
  onCreatePack: (title: string) => Promise<void>;
  onRenamePack: (packId: string, title: string) => Promise<void>;
  onArchivePack: (packId: string, archived: boolean) => Promise<void>;
  onDeletePack: (packId: string) => Promise<void>;
  onCreateUnit: (packId: string, title: string) => Promise<void>;
  onRenameUnit: (unitId: string, title: string) => Promise<void>;
  onDeleteUnit: (unitId: string) => Promise<void>;
}

type Scope = { kind: "all" } | { kind: "pack"; packId: string } | { kind: "unit"; packId: string; unitId: string };
type InlineForm = { kind: "pack"; value: string } | { kind: "unit"; packId: string; value: string } | { kind: "rename-pack"; packId: string; value: string } | { kind: "rename-unit"; unitId: string; value: string };

export function LessonLibraryPanel({
  lessons,
  packs,
  units,
  loading,
  selectedLessonId,
  onSelectLesson,
  onNewLesson,
  onEditLesson,
  onExportLesson,
  onDeleteLesson,
  onConvertLesson,
  onMoveLessons,
  onCreatePack,
  onRenamePack,
  onArchivePack,
  onDeletePack,
  onCreateUnit,
  onRenameUnit,
  onDeleteUnit
}: LessonLibraryPanelProps) {
  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [query, setQuery] = useState("");
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [inlineForm, setInlineForm] = useState<InlineForm | null>(null);
  const [packActionsOpen, setPackActionsOpen] = useState(false);

  const selectedPack = scope.kind === "all" ? null : packs.find((pack) => pack.id === scope.packId) ?? null;
  const selectedUnit = scope.kind === "unit" ? units.find((unit) => unit.id === scope.unitId) ?? null : null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleLessons = useMemo(() => lessons.filter((lesson) => {
    if (scope.kind === "pack" && lesson.packId !== scope.packId) return false;
    if (scope.kind === "unit" && lesson.packUnitId !== scope.unitId) return false;
    if (!normalizedQuery) return true;
    return [lesson.title, lesson.description, lesson.level, ...lesson.tags]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
  }), [lessons, normalizedQuery, scope]);
  const visibleSelectedCount = visibleLessons.filter((lesson) => selectedLessonIds.has(lesson.id)).length;
  const scopeTitle = selectedUnit?.title ?? selectedPack?.title ?? "All lessons";
  const scopeDescription = selectedUnit
    ? `Unit in ${selectedPack?.title ?? "pack"}`
    : selectedPack?.description || (scope.kind === "pack" ? "Lessons at every level in this pack." : "Every lesson in your library.");

  function toggleLesson(lessonId: string) {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
      return next;
    });
  }

  function toggleVisibleLessons() {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      const shouldSelect = visibleSelectedCount !== visibleLessons.length;
      visibleLessons.forEach((lesson) => shouldSelect ? next.add(lesson.id) : next.delete(lesson.id));
      return next;
    });
  }

  async function submitInlineForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inlineForm?.value.trim()) return;
    if (inlineForm.kind === "pack") await onCreatePack(inlineForm.value.trim());
    if (inlineForm.kind === "unit") await onCreateUnit(inlineForm.packId, inlineForm.value.trim());
    if (inlineForm.kind === "rename-pack") await onRenamePack(inlineForm.packId, inlineForm.value.trim());
    if (inlineForm.kind === "rename-unit") await onRenameUnit(inlineForm.unitId, inlineForm.value.trim());
    setInlineForm(null);
  }

  async function moveSelectedLessons() {
    if (!moveTarget) return;
    const [kind, packId, unitId] = moveTarget.split(":");
    await onMoveLessons([...selectedLessonIds], packId, kind === "unit" ? unitId : null);
    setSelectedLessonIds(new Set());
    setMoveTarget("");
  }

  return (
    <section className="lesson-library-shell" aria-label="Lesson library">
      <header className="lesson-library-header">
        <div>
          <h2>Lesson library</h2>
          <p className="muted">Organize lessons into packs, then add units when you need another level.</p>
        </div>
        <button className="button" type="button" data-tour="lesson-library-new" onClick={onNewLesson}>
          <Plus size={18} aria-hidden="true" /> New lesson
        </button>
      </header>

      <div className="lesson-library-workspace">
        <aside className="lesson-organizer" aria-label="Packs and units">
          <div className="lesson-organizer-title">
            <h3>Packs</h3>
            <button className="icon-button" type="button" aria-label="Create pack" onClick={() => setInlineForm({ kind: "pack", value: "" })}>
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>

          <nav className="lesson-pack-tree" aria-label="Lesson groups">
            <button className={scope.kind === "all" ? "active" : ""} type="button" aria-current={scope.kind === "all" ? "page" : undefined} onClick={() => setScope({ kind: "all" })}>
              <Box size={17} aria-hidden="true" /><span>All lessons</span><small>{lessons.length}</small>
            </button>
            {packs.map((pack) => {
              const packUnits = units.filter((unit) => unit.packId === pack.id);
              const packActive = scope.kind !== "all" && scope.packId === pack.id;
              return (
                <div className="lesson-pack-tree-group" key={pack.id}>
                  <button className={scope.kind === "pack" && packActive ? "active" : ""} type="button" aria-current={scope.kind === "pack" && packActive ? "page" : undefined} onClick={() => setScope({ kind: "pack", packId: pack.id })}>
                    {packActive ? <FolderOpen size={17} aria-hidden="true" /> : <Folder size={17} aria-hidden="true" />}
                    <span>{pack.title}</span><small>{pack.lessonCount}</small>
                  </button>
                  {packUnits.map((unit) => (
                    <button className={`lesson-unit-link${scope.kind === "unit" && scope.unitId === unit.id ? " active" : ""}`} type="button" key={unit.id} aria-current={scope.kind === "unit" && scope.unitId === unit.id ? "page" : undefined} onClick={() => setScope({ kind: "unit", packId: pack.id, unitId: unit.id })}>
                      <span>{unit.title}</span><small>{unit.lessonCount}</small>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>

          {inlineForm ? (
            <form className="lesson-inline-form" onSubmit={(event) => void submitInlineForm(event)}>
              <label htmlFor="lesson-group-name">
                {inlineForm.kind === "pack" ? "Pack name" : inlineForm.kind === "unit" ? "Unit name" : "New name"}
              </label>
              <input id="lesson-group-name" className="input" value={inlineForm.value} autoFocus onChange={(event) => setInlineForm({ ...inlineForm, value: event.target.value })} />
              <div className="row compact-row">
                <button className="button compact-button" type="submit">Save</button>
                <button className="button secondary compact-button" type="button" onClick={() => setInlineForm(null)}>Cancel</button>
              </div>
            </form>
          ) : null}
        </aside>

        <main className="lesson-library-main">
          <div className="lesson-library-scope-header">
            <div>
              <div className="row compact-row">
                <h3>{scopeTitle}</h3>
                <span className="pill">{visibleLessons.length}</span>
              </div>
              <p className="muted">{scopeDescription}</p>
            </div>
            {selectedPack ? (
              <div className="lesson-scope-actions">
                {selectedPack.id !== "personal-unsorted" ? <button className="button secondary compact-button" type="button" onClick={() => setInlineForm({ kind: "unit", packId: selectedPack.id, value: "" })}>
                  <Plus size={15} aria-hidden="true" /> Add unit
                </button> : null}
                <button className="icon-button" type="button" aria-label={`More actions for ${scopeTitle}`} aria-expanded={packActionsOpen} onClick={() => setPackActionsOpen((open) => !open)}>
                  <MoreHorizontal size={18} aria-hidden="true" />
                </button>
                {packActionsOpen ? (
                  <div className="lesson-scope-menu">
                    <button type="button" onClick={() => {
                      if (selectedUnit) setInlineForm({ kind: "rename-unit", unitId: selectedUnit.id, value: selectedUnit.title });
                      else setInlineForm({ kind: "rename-pack", packId: selectedPack.id, value: selectedPack.title });
                      setPackActionsOpen(false);
                    }}><Pencil size={15} aria-hidden="true" /> Rename {selectedUnit ? "unit" : "pack"}</button>
                    {!selectedUnit && selectedPack.id !== "personal-unsorted" ? <button type="button" onClick={() => { void onArchivePack(selectedPack.id, !selectedPack.archived); setPackActionsOpen(false); }}><Archive size={15} aria-hidden="true" /> {selectedPack.archived ? "Restore pack" : "Archive pack"}</button> : null}
                    {selectedUnit ? <button className="danger-text" type="button" onClick={() => { if (window.confirm(`Delete ${selectedUnit.title}? Its lessons will stay in ${selectedPack.title}.`)) void onDeleteUnit(selectedUnit.id); setPackActionsOpen(false); }}><Trash2 size={15} aria-hidden="true" /> Delete unit</button> : null}
                    {!selectedUnit && selectedPack.id !== "personal-unsorted" ? <button className="danger-text" type="button" onClick={() => { if (window.confirm(`Delete ${selectedPack.title}? Its lessons will move to Personal / Unsorted.`)) void onDeletePack(selectedPack.id); setScope({ kind: "all" }); setPackActionsOpen(false); }}><Trash2 size={15} aria-hidden="true" /> Delete pack</button> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="lesson-list-toolbar">
            <label className="lesson-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Search lessons</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons" />
            </label>
            {visibleLessons.length ? (
              <label className="lesson-select-all">
                <input type="checkbox" checked={visibleSelectedCount === visibleLessons.length} onChange={toggleVisibleLessons} />
                Select all
              </label>
            ) : null}
          </div>

          {loading ? <p className="muted lesson-list-state">Loading lessons…</p> : null}
          {!loading && !visibleLessons.length ? (
            <div className="lesson-list-state">
              <BookOpen size={28} aria-hidden="true" />
              <strong>{query ? "No matching lessons" : "Nothing here yet"}</strong>
              <p className="muted">{query ? "Try a different search." : "Create a lesson or move one into this group."}</p>
            </div>
          ) : null}

          <div className="lesson-library-items" data-tour="lesson-library-list">
            {visibleLessons.map((lesson) => (
              <article className={`lesson-library-item${lesson.id === selectedLessonId ? " active" : ""}`} key={lesson.id}>
                <input type="checkbox" checked={selectedLessonIds.has(lesson.id)} aria-label={`Select ${lesson.title}`} onChange={() => toggleLesson(lesson.id)} />
                <button className="lesson-library-item-content" type="button" onClick={() => onSelectLesson(lesson.id)}>
                  <strong>{lesson.title}</strong>
                  <span>{lesson.sentenceCount} sentences · {formatLanguageLabel(lesson.language)} → {formatLanguageLabel(lesson.baseLanguage)}</span>
                  {lesson.description ? <p>{lesson.description}</p> : null}
                </button>
                <div className="lesson-row-actions" aria-label={`Actions for ${lesson.title}`}>
                  <button className="icon-button" type="button" aria-label={`Edit ${lesson.title}`} onClick={() => onEditLesson(lesson.id)}><Pencil size={16} aria-hidden="true" /></button>
                  <button className="icon-button" type="button" aria-label={`Export ${lesson.title}`} onClick={() => onExportLesson(lesson.id)}><Download size={16} aria-hidden="true" /></button>
                  <button className="icon-button" type="button" aria-label={`Convert ${lesson.title} to contributor draft`} onClick={() => onConvertLesson(lesson.id)}><Send size={16} aria-hidden="true" /></button>
                  <button className="icon-button danger-text" type="button" aria-label={`Delete ${lesson.title}`} onClick={() => onDeleteLesson(lesson.id)}><Trash2 size={16} aria-hidden="true" /></button>
                </div>
              </article>
            ))}
          </div>

          {selectedLessonIds.size ? (
            <div className="lesson-bulk-bar" role="region" aria-label="Selected lesson actions">
              <strong>{selectedLessonIds.size} selected</strong>
              <label>
                <span className="sr-only">Move selected lessons</span>
                <select className="input selector-compact" value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                  <option value="">Move to…</option>
                  {packs.filter((pack) => !pack.archived).flatMap((pack) => [
                    <option key={`pack:${pack.id}`} value={`pack:${pack.id}`}>{pack.title} (no unit)</option>,
                    ...units.filter((unit) => unit.packId === pack.id).map((unit) => <option key={`unit:${pack.id}:${unit.id}`} value={`unit:${pack.id}:${unit.id}`}>{pack.title} / {unit.title}</option>)
                  ])}
                </select>
              </label>
              <button className="button compact-button" type="button" disabled={!moveTarget} onClick={() => void moveSelectedLessons()}>Move</button>
              <button className="button secondary compact-button" type="button" onClick={() => setSelectedLessonIds(new Set())}>Clear</button>
            </div>
          ) : null}
        </main>
      </div>
    </section>
  );
}
