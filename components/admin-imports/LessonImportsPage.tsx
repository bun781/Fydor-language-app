import {
  BookOpen,
  Check,
  FileJson,
  HelpCircle,
  Library,
  Save,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { LessonBuilderEditor, type ActiveAnnotation } from "@/components/admin-imports/LessonBuilderEditor";
import { LessonLibraryPanel } from "@/components/admin-imports/LessonLibraryPanel";
import { AppendJsonPanel, LessonMetaEditor } from "@/components/admin-imports/LessonMetaEditor";
import { ImportHelpPanel } from "@/components/language/ImportHelpPanel";
import { ImportPreview } from "@/components/language/ImportPreview";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { createTourScope, replayGuidedTour } from "@/components/system/GuidedTour";
import { errorMessage } from "@/lib/errors";
import { clearLocal, readLocal, readSessionProgress, writeSessionProgress } from "@/lib/storage";
import {
  deleteLesson as deleteLessonApi,
  exportLesson as exportLessonApi,
  getLessons,
  getPacks,
  importLesson as importLessonApi,
  moveLessonsToPack,
  openCommunityWorkspace,
  previewLessonImport,
  deletePack,
  upsertPack,
  updatePack,
  updateLesson as updateLessonApi
} from "@/lib/desktopApi";
import type { StudyLessonMeta, StudyPackMeta } from "@/lib/imported-content/types";
import type {
  LessonChunkInput,
  LessonGrammarInput,
  LessonImportInput,
  LessonImportPreviewResult,
  LessonImportSummary,
  LessonSentenceInput,
  LessonWordInput
} from "@/lib/language/types";
import {
  LESSON_IMPORT_DRAFT_KEY,
  clampSentenceIndex,
  createDraft,
  createEmptySentence,
  extractAppendSentences,
  getCharIndex,
  initialLesson,
  pruneEmpty,
  sampleLesson,
  slugifyLessonTitle,
  splitTags,
  stringifyLesson,
  lessonManagerProgressSchema
} from "./lesson-import-utils";
import type { AnnotationDraft, LessonManagerProgress, SelectedSpan, WorkspaceMode } from "./lesson-import-utils";
import { z } from "zod";

type AnnotationKind = AnnotationDraft["kind"];

interface LessonImportsPageProps {
  initialMode?: WorkspaceMode;
}

const LESSON_MANAGER_PROGRESS_KEY = "lesson-manager.workspace";

// Chunk: editor state and data loading
export default function LessonImportsPage({ initialMode = "builder" }: LessonImportsPageProps) {
  const [savedProgress] = useState(() => readSessionProgress(LESSON_MANAGER_PROGRESS_KEY, lessonManagerProgressSchema));
  const initialEditorLesson = savedProgress?.lesson ?? initialLesson;
  const [mode, setMode] = useState<WorkspaceMode>(savedProgress?.mode ?? initialMode);
  const [lesson, setLesson] = useState<LessonImportInput>(initialEditorLesson);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(() => (
    clampSentenceIndex(savedProgress?.activeSentenceIndex ?? 0, initialEditorLesson)
  ));
  const [selection, setSelection] = useState<SelectedSpan | null>(null);
  const [draft, setDraft] = useState<AnnotationDraft>(savedProgress?.draft ?? createDraft());
  const [source, setSource] = useState(() => savedProgress?.source ?? stringifyLesson(initialEditorLesson));
  const [appendSource, setAppendSource] = useState(savedProgress?.appendSource ?? "");
  const [preview, setPreview] = useState<LessonImportPreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<LessonImportSummary | null>(null);
  const [lessonOptions, setLessonOptions] = useState<StudyLessonMeta[]>([]);
  const [packOptions, setPackOptions] = useState<StudyPackMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [targetLessonId, setTargetLessonId] = useState(savedProgress?.targetLessonId ?? "new");
  const [editorLessonId, setEditorLessonId] = useState<string | null>(savedProgress?.editorLessonId ?? null);
  const [selectedLibraryLessonId, setSelectedLibraryLessonId] = useState<string | null>(savedProgress?.selectedLibraryLessonId ?? null);
  const [pendingDeleteLessonId, setPendingDeleteLessonId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [baselineSource, setBaselineSource] = useState(() => savedProgress?.baselineSource ?? stringifyLesson(initialEditorLesson));
  const [pendingReplaceAction, setPendingReplaceAction] = useState<(() => void) | null>(null);

  const draftSource = mode === "json" ? source : stringifyLesson(lesson);
  const draftDirty = draftSource.trim() !== baselineSource.trim();

  const activeSentence = lesson.sentences[activeSentenceIndex] ?? createEmptySentence();
  const appendingToExistingLesson = editorLessonId === null && targetLessonId !== "new";
  const editingExistingLesson = editorLessonId !== null;
  const activeAnnotations = useMemo<ActiveAnnotation[]>(
    () => [
      ...(activeSentence.words ?? []).map((item, index) => ({ kind: "word" as const, index, label: item.surface, detail: item.meaning })),
      ...(activeSentence.grammar ?? []).map((item, index) => ({ kind: "grammar" as const, index, label: item.surface ?? item.pattern, detail: item.meaning })),
      ...(activeSentence.chunks ?? []).map((item, index) => ({ kind: "chunk" as const, index, label: item.surface, detail: item.meaning }))
    ],
    [activeSentence]
  );
  const currentTargetLessonId = editorLessonId ?? (targetLessonId !== "new" ? targetLessonId : undefined);
  const canAppendSentenceJson = Boolean(currentTargetLessonId);
  const usingAppendSentenceJson = canAppendSentenceJson && appendSource.trim().length > 0;
  const saveActionLabel = usingAppendSentenceJson ? "Append" : editingExistingLesson ? "Update" : "Save";
  const targetLesson = lessonOptions.find((item) => item.id === targetLessonId);
  const appendJsonPlaceholder = `{
  "text": "你好。",
  "translation": "Hello.",
  "words": [
    {
      "surface": "你好",
      "meaning": "hello"
    }
  ]
}`;

  useEffect(() => {
    let cancelled = false;

    refreshLessons().finally(() => {
      if (!cancelled) setLessonsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingReplaceAction) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPendingReplaceAction(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingReplaceAction]);

  useEffect(() => {
    if (!pendingDeleteLessonId) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || deletingLessonId) return;
      event.preventDefault();
      setPendingDeleteLessonId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deletingLessonId, pendingDeleteLessonId]);

  useEffect(() => {
    const importedSource = readLocal(LESSON_IMPORT_DRAFT_KEY, z.string());
    if (!importedSource) return;

    clearLocal(LESSON_IMPORT_DRAFT_KEY);
    loadLessonSource(importedSource, "builder");
  }, []);

  useEffect(() => {
    writeSessionProgress(LESSON_MANAGER_PROGRESS_KEY, {
      mode,
      lesson,
      activeSentenceIndex,
      draft,
      source,
      appendSource,
      targetLessonId,
      editorLessonId,
      selectedLibraryLessonId,
      baselineSource
    } satisfies LessonManagerProgress);
  }, [activeSentenceIndex, appendSource, baselineSource, draft, editorLessonId, lesson, mode, selectedLibraryLessonId, source, targetLessonId]);

  function syncLesson(nextLesson: LessonImportInput) {
    setLesson(nextLesson);
    setSource(stringifyLesson(nextLesson));
    setPreview(null);
    setSummary(null);
    setStatus("");
    setErrors([]);
  }

  async function refreshLessons() {
    try {
      const [items, packs] = await Promise.all([getLessons(), getPacks()]);
      setLessonOptions(items);
      setPackOptions(packs);
    } catch (error) {
      setErrors([errorMessage(error, "Unable to load lessons.")]);
    }
  }

  function loadLessonSource(text: string, fallbackMode: WorkspaceMode, lessonId: string | null = null) {
    setSource(text);
    setTargetLessonId("new");
    setEditorLessonId(lessonId);
    setSelectedLibraryLessonId(lessonId);
    setActiveSentenceIndex(0);
    setSelection(null);
    setDraft(createDraft());
    setPreview(null);
    setErrors([]);
    setStatus("");
    setSummary(null);
    setAppendSource("");

    try {
      const parsed = JSON.parse(text) as LessonImportInput;
      setLesson(parsed);
      setBaselineSource(stringifyLesson(parsed));
      setMode("builder");
    } catch {
      setBaselineSource(text);
      setMode(fallbackMode);
    }
  }

  // Ask before replacing the editor content when it has edits that were never saved.
  function confirmDraftReplace(action: () => void) {
    if (!draftDirty) {
      action();
      return;
    }
    setPendingReplaceAction(() => action);
  }

  function updateLessonField<K extends keyof LessonImportInput>(field: K, value: LessonImportInput[K]) {
    syncLesson({ ...lesson, [field]: value });
  }

  function addTagFromValue(value: string) {
    const nextTags = splitTags(value);
    if (!nextTags.length) return;
    updateLessonField("tags", Array.from(new Set([...(lesson.tags ?? []), ...nextTags])));
  }

  function removeLessonTag(tagToRemove: string) {
    updateLessonField("tags", (lesson.tags ?? []).filter((tag) => tag !== tagToRemove));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addTagFromValue(event.currentTarget.value);
    event.currentTarget.value = "";
  }

  function updateSentence(field: keyof LessonSentenceInput, value: string) {
    const sentences = lesson.sentences.map((sentence, index) => (
      index === activeSentenceIndex ? { ...sentence, [field]: value } : sentence
    ));
    syncLesson({ ...lesson, sentences });
    setSelection(null);
    setDraft(createDraft());
  }

  function addSentence(afterIndex = activeSentenceIndex) {
    const nextSentence = createEmptySentence();
    const sentences = [...lesson.sentences];
    sentences.splice(Math.min(afterIndex + 1, sentences.length), 0, nextSentence);
    syncLesson({ ...lesson, sentences });
    setActiveSentenceIndex(Math.min(afterIndex + 1, sentences.length - 1));
    setSelection(null);
    setDraft(createDraft());
  }

  function removeSentence(indexToRemove: number) {
    if (lesson.sentences.length === 1) return;
    const sentences = lesson.sentences.filter((_, index) => index !== indexToRemove);
    const nextIndex = Math.min(activeSentenceIndex, sentences.length - 1);
    syncLesson({ ...lesson, sentences });
    setActiveSentenceIndex(nextIndex);
    setSelection(null);
    setDraft(createDraft());
  }

  function captureSelection() {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.isCollapsed) return;

    const anchor = getCharIndex(browserSelection.anchorNode);
    const focus = getCharIndex(browserSelection.focusNode);
    if (anchor === null || focus === null) return;

    const start = Math.min(anchor, focus);
    const end = Math.max(anchor, focus);
    const chars = Array.from(activeSentence.text);
    const surface = chars.slice(start, end + 1).join("").trim();
    browserSelection.removeAllRanges();

    if (!surface) return;
    const selected = { start, end, surface };
    setSelection(selected);
    setDraft((current) => ({
      ...createDraft(surface),
      kind: current.kind,
      pattern: current.kind === "grammar" ? surface : ""
    }));
  }

  function addAnnotation() {
    const surface = draft.surface.trim();
    if (!surface) {
      setErrors(["Select text in the sentence or enter a surface manually."]);
      return;
    }

    const sentence = lesson.sentences[activeSentenceIndex];
    let nextSentence: LessonSentenceInput;

    if (draft.kind === "word") {
      const word: LessonWordInput = pruneEmpty({
        surface,
        lemma: draft.lemma,
        meaning: draft.meaning,
        role: draft.role,
        explanation: draft.explanation
      });
      nextSentence = { ...sentence, words: [...(sentence.words ?? []), word] };
    } else if (draft.kind === "grammar") {
      const grammar: LessonGrammarInput = pruneEmpty({
        pattern: draft.pattern.trim() || surface,
        surface,
        meaning: draft.meaning,
        explanation: draft.explanation
      });
      nextSentence = { ...sentence, grammar: [...(sentence.grammar ?? []), grammar] };
    } else {
      const chunk: LessonChunkInput = pruneEmpty({
        surface,
        meaning: draft.meaning,
        explanation: draft.explanation,
        type: draft.chunkType,
        level: draft.level,
        tags: splitTags(draft.tags)
      });
      nextSentence = { ...sentence, chunks: [...(sentence.chunks ?? []), chunk] };
    }

    const sentences = lesson.sentences.map((item, index) => index === activeSentenceIndex ? nextSentence : item);
    syncLesson({ ...lesson, sentences });
    setSelection(null);
    setDraft(createDraft());
  }

  function removeAnnotation(kind: AnnotationKind, annotationIndex: number) {
    const sentence = lesson.sentences[activeSentenceIndex];
    const nextSentence = {
      ...sentence,
      words: kind === "word" ? (sentence.words ?? []).filter((_, index) => index !== annotationIndex) : sentence.words,
      grammar: kind === "grammar" ? (sentence.grammar ?? []).filter((_, index) => index !== annotationIndex) : sentence.grammar,
      chunks: kind === "chunk" ? (sentence.chunks ?? []).filter((_, index) => index !== annotationIndex) : sentence.chunks
    };
    const sentences = lesson.sentences.map((item, index) => index === activeSentenceIndex ? nextSentence : item);
    syncLesson({ ...lesson, sentences });
  }

  async function requestPreview(modeLabel: "validate" | "preview") {
    await withJsonSource(async (jsonSource, lessonId) => {
      setLoading(true);
      setErrors([]);
      setStatus("");
      setSummary(null);

      try {
        const nextPreview = await previewLessonImport(jsonSource, lessonId);
        setPreview(nextPreview);
        setStatus(modeLabel === "validate" ? "Validation passed." : "Preview ready.");
      } catch (error) {
        setPreview(null);
        setErrors([errorMessage(error, "Unable to validate lesson.")]);
      } finally {
        setLoading(false);
      }
    });
  }

  async function saveLesson() {
    await withJsonSource(async (jsonSource, lessonId) => {
      setImporting(true);
      setErrors([]);
      setStatus("");
      try {
        const shouldAppendSentenceJson = Boolean(lessonId && appendSource.trim());
        const result = shouldAppendSentenceJson
          ? await importLessonApi(jsonSource, lessonId)
          : editorLessonId
            ? await updateLessonApi(editorLessonId, jsonSource)
            : await importLessonApi(jsonSource, lessonId);
        setPreview(null);
        if (result.errors.length) {
          setSummary(null);
          setErrors(result.errors);
          return;
        }
        if (result.lessonCreated && result.lessonId) {
          const importedLesson = JSON.parse(jsonSource) as LessonImportInput;
          const pack = await upsertPack({
            title: `Imported · ${importedLesson.title}`,
            description: importedLesson.description ?? "Imported lesson",
            language: importedLesson.language,
            baseLanguage: importedLesson.baseLanguage,
            level: importedLesson.level,
            tags: importedLesson.tags,
            sourceType: "import"
          });
          await moveLessonsToPack([result.lessonId], pack.id);
        }
        setSummary(result);
        setStatus(shouldAppendSentenceJson ? "Sentences appended." : editorLessonId ? "Lesson updated." : lessonId ? "Sentences appended." : "Lesson saved.");
        if (!shouldAppendSentenceJson) setBaselineSource(jsonSource);
        await refreshLessons();
      } catch (error) {
        setErrors([errorMessage(error, "Unable to import lesson.")]);
      } finally {
        setImporting(false);
      }
    });
  }

  async function withJsonSource(callback: (jsonSource: string, lessonId?: string) => Promise<void>) {
    const lessonId = currentTargetLessonId;

    if (lessonId && appendSource.trim()) {
      try {
        await callback(buildAppendJsonSource(appendSource, lessonId), lessonId);
      } catch (error) {
        setErrors([errorMessage(error, "Invalid append sentence JSON.")]);
      }
      return;
    }

    if (mode === "builder") {
      await callback(stringifyLesson(lesson), lessonId);
      return;
    }

    let parsed: LessonImportInput;
    try {
      parsed = JSON.parse(source) as LessonImportInput;
    } catch (error) {
      setErrors([`Invalid JSON: ${errorMessage(error, "the text could not be parsed.")}`]);
      return;
    }
    setLesson(parsed);
    await callback(source, lessonId);
  }

  function buildAppendJsonSource(jsonSource: string, lessonId: string): string {
    const target = lessonOptions.find((item) => item.id === lessonId);
    const targetLanguage = target?.language ?? (editorLessonId === lessonId ? lesson.language : undefined);
    const targetBaseLanguage = target?.baseLanguage ?? (editorLessonId === lessonId ? lesson.baseLanguage : undefined);
    const targetTitle = target?.title ?? (editorLessonId === lessonId ? lesson.title : undefined);

    if (!targetLanguage || !targetBaseLanguage || !targetTitle) {
      throw new Error("Choose an existing lesson before appending sentence JSON.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonSource);
    } catch {
      throw new Error("Invalid append sentence JSON.");
    }

    const sentences = extractAppendSentences(parsed);
    if (!sentences.length) {
      throw new Error("Append JSON must be a sentence object, an array of sentence objects, or an object with a sentences array.");
    }

    const appendLesson: LessonImportInput = {
      language: targetLanguage,
      baseLanguage: targetBaseLanguage,
      title: targetTitle,
      description: target?.description ?? lesson.description ?? undefined,
      level: target?.level ?? lesson.level ?? undefined,
      tags: target?.tags ?? lesson.tags,
      source: "json_append",
      sentences
    };

    return JSON.stringify(appendLesson);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    confirmDraftReplace(() => loadLessonSource(text, "json"));
  }

  function loadSample() {
    confirmDraftReplace(() => loadLessonSource(sampleLesson, "builder"));
  }

  async function openLessonInEditor(lessonId: string) {
    try {
      const exportedLesson = await exportLessonApi(lessonId);
      loadLessonSource(stringifyLesson(exportedLesson), "builder", lessonId);
      setMode("builder");
    } catch (error) {
      setErrors([errorMessage(error, "Unable to open the selected lesson.")]);
    }
  }

  function startNewLesson() {
    loadLessonSource(stringifyLesson(initialLesson), "builder", null);
    setMode("builder");
  }

  async function exportLessonToFile(lessonId: string) {
    try {
      const exportedLesson = await exportLessonApi(lessonId);
      const blob = new Blob([JSON.stringify(exportedLesson, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugifyLessonTitle(exportedLesson.title)}.json`;
      link.click();
      window.URL.revokeObjectURL(url);
      setStatus(`Exported ${exportedLesson.title}.`);
    } catch (error) {
      setErrors([errorMessage(error, "Unable to export lesson.")]);
    }
  }

  async function convertToContributorDraft(lessonId: string) {
    try {
      const personalLesson = await exportLessonApi(lessonId);
      const contributorLesson = {
        schemaVersion: 1 as const,
        ...personalLesson,
        description: personalLesson.description ?? "",
        level: personalLesson.level ?? "",
        tags: personalLesson.tags ?? [],
        sentences: personalLesson.sentences.map((sentence) => ({
          ...sentence,
          translation: sentence.translation ?? ""
        }))
      };
      await navigator.clipboard.writeText(JSON.stringify(contributorLesson, null, 2));
      await openCommunityWorkspace("contributor", lessonId);
      setStatus("Personal lesson copied. Continue in the online Fydor contributor workspace; the original remains private and unchanged.");
    } catch (error) {
      setErrors([errorMessage(error, "Unable to prepare this contributor draft.")]);
    }
  }

  function requestDeleteLesson(lessonId: string) {
    setPendingDeleteLessonId(lessonId);
  }

  async function confirmDeleteLesson() {
    if (!pendingDeleteLessonId) return;
    const lessonId = pendingDeleteLessonId;
    const lesson = lessonOptions.find((item) => item.id === lessonId);
    const previousLessons = lessonOptions;

    try {
      setDeletingLessonId(lessonId);
      setErrors([]);
      setLessonOptions((items) => items.filter((item) => item.id !== lessonId));
      setPendingDeleteLessonId(null);
      if (editorLessonId === lessonId) {
        startNewLesson();
      }
      if (selectedLibraryLessonId === lessonId) {
        setSelectedLibraryLessonId(null);
      }
      await deleteLessonApi(lessonId);
      setStatus(`${lesson?.title ?? "Lesson"} deleted.`);
      await refreshLessons();
    } catch (error) {
      setLessonOptions(previousLessons);
      if (selectedLibraryLessonId === lessonId) {
        setSelectedLibraryLessonId(lessonId);
      }
      setErrors([errorMessage(error, "Unable to delete lesson.")]);
    } finally {
      setDeletingLessonId(null);
    }
  }

  // Chunk: rendered editor layout
  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Manager</h1>
          <p className="muted">Add, import, export, rename, edit, and delete lessons from one place.</p>
        </div>
        <div className="row compact-row">
          <button className="button secondary" type="button" data-tour="lesson-sample" onClick={loadSample}>
            <Sparkles size={18} />
            Sample lesson
          </button>
          <label className="button secondary">
            <FileJson size={18} />
            Upload
            <input
              className="hidden-input"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void readFile(file);
              }}
            />
          </label>
        </div>
      </div>

      <section className="card lesson-builder-top">
        <div className="lesson-builder-topbar">
          <div className="lesson-builder-topbar-left">
            <div className="mode-tabs" role="tablist" aria-label="Lesson editor mode">
              <button className={mode === "builder" ? "active" : ""} type="button" role="tab" aria-selected={mode === "builder"} data-tour="lesson-editor-mode" onClick={() => setMode("builder")}>
                <BookOpen size={17} />
                Builder
              </button>
              <button className={mode === "json" ? "active" : ""} type="button" role="tab" aria-selected={mode === "json"} onClick={() => {
                setSource(stringifyLesson(lesson));
                setMode("json");
              }} data-tour="lesson-json-mode">
                <FileJson size={17} />
                JSON
              </button>
              <button className={mode === "lessons" ? "active" : ""} type="button" role="tab" aria-selected={mode === "lessons"} data-tour="lesson-library-tab" onClick={() => setMode("lessons")}>
                <Library size={17} />
                Lessons
              </button>
            </div>
            <Tooltip content="Open the guide for this tab.">
              <button
                className="icon-button"
                type="button"
                aria-label="Open tab guide"
                onClick={() => replayGuidedTour(createTourScope("/lessons/manage", mode))}
              >
                <HelpCircle size={17} />
              </button>
            </Tooltip>
          </div>
        </div>

        {mode === "lessons" ? (
          <p className="muted lesson-mode-note">
            Browse saved lessons, export them, or open one in the editor to rename and modify it.
          </p>
        ) : (
          <>
            <div className="lesson-builder-topbar-right">
              <div className="lesson-builder-actions">
                <button className="button secondary compact-button" type="button" data-tour="lesson-check" disabled={loading} onClick={() => requestPreview("validate")}>
                  <Check size={16} />
                  Check
                </button>
                <button className="button secondary compact-button" type="button" disabled={loading} onClick={() => requestPreview("preview")}>
                  <Upload size={16} />
                  {loading ? "Checking…" : "Preview"}
                </button>
                <button className="button compact-button" type="button" data-tour="lesson-save" disabled={importing} onClick={saveLesson}>
                  <Save size={16} />
                  {importing ? "Saving…" : saveActionLabel}
                </button>
              </div>
              <ImportHelpPanel />
            </div>

            <LessonMetaEditor
              lesson={lesson}
              lessonOptions={lessonOptions}
              lessonsLoading={lessonsLoading}
              targetLessonId={targetLessonId}
              editingExistingLesson={editingExistingLesson}
              targetLesson={targetLesson}
              onFieldChange={updateLessonField}
              onRemoveTag={removeLessonTag}
              onTagKeyDown={handleTagKeyDown}
              onAddTag={addTagFromValue}
              onTargetLessonChange={(value) => {
                setTargetLessonId(value);
                if (value === "new") setAppendSource("");
                setPreview(null);
                setSummary(null);
                setStatus("");
              }}
            />

            {canAppendSentenceJson ? (
              <AppendJsonPanel
                appendSource={appendSource}
                placeholder={appendJsonPlaceholder}
                onClear={() => {
                  setAppendSource("");
                  setPreview(null);
                  setSummary(null);
                }}
                onChange={(value) => {
                  setAppendSource(value);
                  setPreview(null);
                  setSummary(null);
                  setStatus("");
                }}
              />
            ) : null}
          </>
        )}
      </section>

      {mode === "lessons" ? (
        <LessonLibraryPanel
          lessons={lessonOptions}
          packs={packOptions}
          loading={lessonsLoading}
          selectedLessonId={selectedLibraryLessonId}
          onSelectLesson={setSelectedLibraryLessonId}
          onNewLesson={() => confirmDraftReplace(startNewLesson)}
          onEditLesson={(lessonId) => confirmDraftReplace(() => void openLessonInEditor(lessonId))}
          onExportLesson={exportLessonToFile}
          onDeleteLesson={requestDeleteLesson}
          onConvertLesson={(lessonId) => void convertToContributorDraft(lessonId)}
          onMoveLessons={async (lessonIds, packId) => {
            await moveLessonsToPack(lessonIds, packId);
            await refreshLessons();
          }}
          onCreatePack={async (title) => {
            await upsertPack({ title, sourceType: "personal" });
            await refreshLessons();
          }}
          onRenamePack={async (packId, title) => {
            const pack = packOptions.find((item) => item.id === packId);
            await updatePack(packId, title, pack?.description ?? "", Boolean(pack?.archived));
            await refreshLessons();
          }}
          onArchivePack={async (packId, archived) => {
            const pack = packOptions.find((item) => item.id === packId);
            await updatePack(packId, pack?.title ?? "Pack", pack?.description ?? "", archived);
            await refreshLessons();
          }}
          onDeletePack={async (packId) => {
            await deletePack(packId);
            await refreshLessons();
          }}
        />
      ) : mode === "builder" ? (
        <LessonBuilderEditor
          lesson={lesson}
          activeSentence={activeSentence}
          activeSentenceIndex={activeSentenceIndex}
          selection={selection}
          draft={draft}
          activeAnnotations={activeAnnotations}
          setDraft={setDraft}
          onUpdateSentence={updateSentence}
          onAddSentence={addSentence}
          onRemoveSentence={removeSentence}
          onCaptureSelection={captureSelection}
          onSelectSentence={(index) => {
            setActiveSentenceIndex(index);
            setSelection(null);
            setDraft(createDraft());
          }}
          onAddAnnotation={addAnnotation}
          onRemoveAnnotation={removeAnnotation}
        />
      ) : (
        <section className="card stack">
          <textarea className="input code-input" value={source} onChange={(event) => {
            setSource(event.target.value);
            setPreview(null);
            setSummary(null);
          }} aria-label="Lesson JSON" />
        </section>
      )}

      {errors.length ? (
        <section className="card stack error-card" role="alert">
          <h2>Validation Errors</h2>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </section>
      ) : null}

      {status ? <section className="card success-card">{status}</section> : null}

      {summary ? (
        <section className="card stack">
          <h2>Save Summary</h2>
          <div className="session-stats">
            <span className="pill">Sentences added {summary.sentencesImported}</span>
            {summary.sentencesSkipped > 0 ? <span className="pill">Duplicates skipped {summary.sentencesSkipped}</span> : null}
            <span className="pill">Words {summary.vocabularyCreated} new / {summary.vocabularyReused} reused</span>
            <span className="pill">Grammar {summary.grammarCreated} new / {summary.grammarReused} reused</span>
            <span className="pill">Chunks {summary.chunksCreated} new / {summary.chunksReused} reused</span>
            <span className="pill">Links {summary.linksCreated}</span>
          </div>
        </section>
      ) : null}

      {preview ? (
        <div className="import-preview-wrap">
          <ImportPreview
            preview={preview}
            importing={importing}
            approveLabel={usingAppendSentenceJson || appendingToExistingLesson ? "Append sentences" : editingExistingLesson ? "Update lesson" : "Save lesson"}
            onApprove={saveLesson}
            onCancel={() => setPreview(null)}
          />
        </div>
      ) : null}

      {pendingReplaceAction ? (
        <ConfirmDialog
          idPrefix="replace-draft"
          title="Discard unsaved changes?"
          description="The editor has changes that were never saved. Loading new content will discard them."
          cancelLabel="Keep editing"
          confirmLabel="Discard and continue"
          confirmDanger
          onCancel={() => setPendingReplaceAction(null)}
          onConfirm={() => {
            const action = pendingReplaceAction;
            setPendingReplaceAction(null);
            action();
          }}
        />
      ) : null}

      {pendingDeleteLessonId ? (
        <ConfirmDialog
          idPrefix="delete-lesson"
          title="Delete lesson?"
          description={<>Delete {lessonOptions.find((item) => item.id === pendingDeleteLessonId)?.title ?? "this lesson"}? This cannot be undone.</>}
          descriptionMuted={false}
          cancelLabel="Cancel"
          confirmLabel={<><Trash2 size={18} />{deletingLessonId ? "Deleting..." : "Delete lesson"}</>}
          confirmDanger
          busy={deletingLessonId !== null}
          dialogClassName="lesson-delete-dialog"
          onCancel={() => setPendingDeleteLessonId(null)}
          onConfirm={confirmDeleteLesson}
        />
      ) : null}
    </AppShell>
  );
}
