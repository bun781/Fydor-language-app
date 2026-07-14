import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";
import type { StudyScope } from "@/lib/studyScope";

interface Props {
  packs: StudyPackMeta[];
  lessons: StudyLessonMeta[];
  scope: StudyScope;
  onChange: (scope: StudyScope) => void;
  title?: string;
}

export function StudyScopePicker({ packs, lessons, scope, onChange, title = "Study scope" }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const activePacks = packs.filter((pack) => !pack.archived);
  const selectedPackIds = new Set(scope.allPacks ? activePacks.map((pack) => pack.id) : scope.packIds);
  const selectedLessonIds = new Set(scope.lessonIds);
  const excludedLessonIds = new Set(scope.excludedLessonIds);

  const visibleLessons = useMemo(() => lessons.filter((lesson) => {
    if (lesson.packArchived) return false;
    if (!normalizedQuery) return true;
    return `${lesson.title} ${lesson.description ?? ""} ${lesson.tags.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery);
  }), [lessons, normalizedQuery]);

  const visiblePackIds = new Set(visibleLessons.map((lesson) => lesson.packId).filter((id): id is string => Boolean(id)));
  const selectedCount = lessons.filter((lesson) => isLessonSelected(lesson)).length;
  const selectedSentences = lessons.reduce((total, lesson) => total + (isLessonSelected(lesson) ? lesson.sentenceCount : 0), 0);

  function isLessonSelected(lesson: StudyLessonMeta) {
    if (excludedLessonIds.has(lesson.id)) return false;
    if (selectedLessonIds.has(lesson.id)) return true;
    return Boolean(lesson.packId && selectedPackIds.has(lesson.packId));
  }

  function update(next: Partial<StudyScope>) {
    onChange({ ...scope, ...next });
  }

  function selectAllPacks() {
    update({ allPacks: true, packIds: [], lessonIds: [], excludedLessonIds: [] });
  }

  function clearAll() {
    update({ allPacks: false, packIds: [], lessonIds: [], excludedLessonIds: [] });
  }

  function togglePack(packId: string) {
    const packLessons = lessons.filter((lesson) => lesson.packId === packId);
    const currentlySelected = selectedPackIds.has(packId) && packLessons.every((lesson) => isLessonSelected(lesson));
    if (scope.allPacks) {
      update({
        allPacks: false,
        packIds: activePacks.map((pack) => pack.id).filter((id) => id !== packId),
        lessonIds: [],
        excludedLessonIds: []
      });
      return;
    }
    if (currentlySelected) {
      update({
        packIds: scope.packIds.filter((id) => id !== packId),
        lessonIds: scope.lessonIds.filter((id) => !packLessons.some((lesson) => lesson.id === id)),
        excludedLessonIds: scope.excludedLessonIds.filter((id) => !packLessons.some((lesson) => lesson.id === id))
      });
      return;
    }
    update({
      packIds: [...new Set([...scope.packIds, packId])],
      lessonIds: scope.lessonIds.filter((id) => !packLessons.some((lesson) => lesson.id === id)),
      excludedLessonIds: scope.excludedLessonIds.filter((id) => !packLessons.some((lesson) => lesson.id === id))
    });
  }

  function toggleLesson(lesson: StudyLessonMeta) {
    const nextExcluded = new Set(scope.excludedLessonIds);
    const nextLessons = new Set(scope.lessonIds);
    const selected = isLessonSelected(lesson);
    if (selected) {
      if (lesson.packId && selectedPackIds.has(lesson.packId)) nextExcluded.add(lesson.id);
      else nextLessons.delete(lesson.id);
    } else {
      nextExcluded.delete(lesson.id);
      nextLessons.add(lesson.id);
    }
    update({
      allPacks: false,
      packIds: scope.allPacks ? activePacks.map((pack) => pack.id) : scope.packIds,
      lessonIds: [...nextLessons],
      excludedLessonIds: [...nextExcluded]
    });
  }

  function toggleVisible() {
    const allVisibleSelected = visibleLessons.length > 0 && visibleLessons.every(isLessonSelected);
    let next = { ...scope, allPacks: false };
    if (allVisibleSelected) {
      for (const lesson of visibleLessons) {
        const current = new Set(next.excludedLessonIds);
        const selected = new Set(next.lessonIds);
        if (lesson.packId && selectedPackIds.has(lesson.packId)) current.add(lesson.id);
        else selected.delete(lesson.id);
        next = { ...next, lessonIds: [...selected], excludedLessonIds: [...current] };
      }
    } else {
      for (const lesson of visibleLessons) {
        const current = new Set(next.excludedLessonIds);
        const selected = new Set(next.lessonIds);
        current.delete(lesson.id);
        selected.add(lesson.id);
        next = { ...next, lessonIds: [...selected], excludedLessonIds: [...current] };
      }
    }
    onChange(next);
  }

  return (
    <fieldset className="study-scope-picker">
      <div className="study-scope-heading">
        <div>
          <legend>{title}</legend>
          <p className="muted">Select packs first, then refine individual lessons if needed.</p>
        </div>
        <span className="pill">{selectedCount} lessons · {selectedSentences} sentences</span>
      </div>
      <div className="study-scope-toolbar">
        <label className="study-scope-search"><Search size={16} /><input value={query} placeholder="Search lessons" aria-label="Search lessons" onChange={(event) => setQuery(event.target.value)} /></label>
        <button className="button secondary" type="button" onClick={selectAllPacks} disabled={scope.allPacks}>All packs</button>
        <button className="button secondary" type="button" onClick={clearAll} disabled={!selectedCount}>Clear</button>
        <button className="button secondary" type="button" onClick={toggleVisible} disabled={!visibleLessons.length}>{visibleLessons.every(isLessonSelected) ? "Clear visible" : "Select visible"}</button>
      </div>
      <div className="study-scope-list">
        {activePacks.filter((pack) => !normalizedQuery || visiblePackIds.has(pack.id)).map((pack) => {
          const packLessons = visibleLessons.filter((lesson) => lesson.packId === pack.id);
          const allPackLessons = lessons.filter((lesson) => lesson.packId === pack.id);
          const selectedPackLessons = allPackLessons.filter(isLessonSelected).length;
          const packSelected = selectedPackLessons === allPackLessons.length && allPackLessons.length > 0;
          const partiallySelected = selectedPackLessons > 0 && !packSelected;
          const isExpanded = expanded.has(pack.id);
          return (
            <div className="study-scope-pack" key={pack.id}>
              <div className="study-scope-pack-row">
                <button className="icon-button" type="button" aria-label={`${isExpanded ? "Collapse" : "Expand"} ${pack.title}`} onClick={() => setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(pack.id)) next.delete(pack.id); else next.add(pack.id);
                  return next;
                })}>{isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
                <input type="checkbox" checked={packSelected} ref={(element) => { if (element) element.indeterminate = partiallySelected; }} aria-label={`Select ${pack.title}`} onChange={() => togglePack(pack.id)} />
                <span className="study-scope-pack-copy"><strong>{pack.title}</strong><small>{pack.lessonCount} lessons · {pack.sentenceCount} sentences{packLessons.length !== allPackLessons.length ? ` · ${packLessons.length} visible` : ""}</small></span>
                <span className="pill">{selectedPackLessons}/{allPackLessons.length}</span>
              </div>
              {isExpanded ? (
                <div className="study-scope-lessons">
                  {packLessons.map((lesson) => <label className="study-scope-lesson" key={lesson.id}>
                    <input type="checkbox" checked={isLessonSelected(lesson)} onChange={() => toggleLesson(lesson)} />
                    <span><strong>{lesson.title}</strong><small>{lesson.sentenceCount} sentences{lesson.level ? ` · ${lesson.level}` : ""}</small></span>
                  </label>)}
                </div>
              ) : null}
            </div>
          );
        })}
        {activePacks.length === 0 ? <p className="muted">No packs available.</p> : null}
      </div>
    </fieldset>
  );
}
