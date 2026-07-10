import { Link } from "react-router-dom";
import {
  Archive,
  Download,
  FileUp,
  Filter,
  PackageCheck,
  PackageOpen,
  Search,
  Upload
} from "lucide-react";
import { countSentences, estimatePackSize, type FydorPack, type FydorPackValidation } from "@/lib/fydor-pack";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { DuplicateMode, ExchangePackMetadata, InstalledPackRecord, InstallSummary } from "./FydorExchangePage";

export function InstallPackSection({
  packSource,
  packPreview,
  duplicateIndexes,
  selectedInstallLessons,
  duplicateMode,
  installing,
  installSummary,
  onReadFile,
  onPreviewPack,
  onPackSourceChange,
  onToggleLesson,
  onDuplicateModeChange,
  onInstall
}: {
  packSource: string;
  packPreview: FydorPackValidation | null;
  duplicateIndexes: Set<number>;
  selectedInstallLessons: Set<number>;
  duplicateMode: DuplicateMode;
  installing: boolean;
  installSummary: InstallSummary | null;
  onReadFile: (file: File | undefined) => void;
  onPreviewPack: () => void;
  onPackSourceChange: (value: string) => void;
  onToggleLesson: (index: number) => void;
  onDuplicateModeChange: (mode: DuplicateMode) => void;
  onInstall: () => void;
}) {
  return (
    <section className="card stack exchange-section" data-tour="exchange-install">
      <div className="exchange-section-heading">
        <FileUp size={20} />
        <div>
          <h2>Install Pack</h2>
          <p className="muted">Import a lesson pack shared by a teacher or another Fydor user.</p>
        </div>
      </div>

      <div className="exchange-actions">
        <label className="button secondary">
          <Upload size={18} />
          Select file
          <input className="hidden-input" type="file" accept=".fydorpack,application/json,.json" onChange={(event) => onReadFile(event.target.files?.[0])} />
        </label>
        <button className="button secondary" type="button" onClick={onPreviewPack}>
          <PackageOpen size={18} />
          Preview pack
        </button>
      </div>

      <label className="field">
        <span>Advanced pack data</span>
        <textarea
          className="input code-input exchange-pack-input"
          value={packSource}
          placeholder="Paste Fydor Pack data here."
          onChange={(event) => onPackSourceChange(event.target.value)}
        />
      </label>

      {packPreview?.pack ? (
        <PackPreview
          validation={packPreview}
          duplicateIndexes={duplicateIndexes}
          selectedLessons={selectedInstallLessons}
          duplicateMode={duplicateMode}
          installing={installing}
          onToggleLesson={onToggleLesson}
          onDuplicateModeChange={onDuplicateModeChange}
          onInstall={onInstall}
        />
      ) : null}

      {installSummary ? (
        <section className="exchange-summary">
          <h3>Install Summary</h3>
          <div className="exchange-stat-row">
            <span><strong>{installSummary.installed}</strong> installed</span>
            <span><strong>{installSummary.skipped}</strong> skipped</span>
            <span><strong>{installSummary.replaced}</strong> replaced</span>
            <span><strong>{installSummary.sentenceCount}</strong> sentences</span>
          </div>
          <div className="exchange-actions">
            <Link className="button secondary" to="/lessons/manage">Go to Lessons</Link>
            <Link className="button" to="/review">Start Review</Link>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function SharePackSection({
  lessons,
  lessonsLoading,
  selectedLessonIds,
  metadata,
  exporting,
  publishing,
  exportPreview,
  onSelectAll,
  onClearSelection,
  onToggleLesson,
  onMetadataChange,
  onBuildPreview,
  onExportSelected,
  onExportAll,
  onPublishSelected
}: {
  lessons: StudyLessonMeta[];
  lessonsLoading: boolean;
  selectedLessonIds: Set<string>;
  metadata: ExchangePackMetadata;
  exporting: boolean;
  publishing: boolean;
  exportPreview: FydorPack | null;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleLesson: (lessonId: string) => void;
  onMetadataChange: (metadata: ExchangePackMetadata) => void;
  onBuildPreview: () => void;
  onExportSelected: () => void;
  onExportAll: () => void;
  onPublishSelected: () => void;
}) {
  return (
    <section className="card stack exchange-section" data-tour="exchange-share">
      <div className="exchange-section-heading">
        <Download size={20} />
        <div>
          <h2>Share Pack</h2>
          <p className="muted">Export your lessons as a Fydor Pack.</p>
        </div>
      </div>

      <div className="exchange-select-all">
        <button className="button secondary" type="button" disabled={lessonsLoading || lessons.length === 0} onClick={onSelectAll}>
          Select all lessons
        </button>
        <button className="button secondary" type="button" disabled={selectedLessonIds.size === 0} onClick={onClearSelection}>
          Clear
        </button>
      </div>

      <div className="exchange-lesson-picker">
        {lessonsLoading ? <p className="muted">Loading lessons...</p> : null}
        {!lessonsLoading && lessons.length === 0 ? <p className="muted">No lessons yet. Create or install a lesson before exporting a pack.</p> : null}
        {lessons.map((lesson) => (
          <label className="exchange-check-row" key={lesson.id}>
            <input type="checkbox" checked={selectedLessonIds.has(lesson.id)} onChange={() => onToggleLesson(lesson.id)} />
            <span>
              <strong>{lesson.title}</strong>
              <small>{lesson.sentenceCount} sentences · {lesson.language} to {lesson.baseLanguage}</small>
            </span>
          </label>
        ))}
      </div>

      <div className="exchange-meta-grid">
        <label className="field">
          <span>Pack title</span>
          <input className="input" value={metadata.title} onChange={(event) => onMetadataChange({ ...metadata, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Version</span>
          <input className="input" value={metadata.version} onChange={(event) => onMetadataChange({ ...metadata, version: event.target.value })} />
        </label>
        <label className="field exchange-wide-field">
          <span>Description</span>
          <textarea className="input small-textarea" value={metadata.description} onChange={(event) => onMetadataChange({ ...metadata, description: event.target.value })} />
        </label>
        <label className="field">
          <span>Author</span>
          <input className="input" value={metadata.author} onChange={(event) => onMetadataChange({ ...metadata, author: event.target.value })} />
        </label>
        <label className="field">
          <span>Organization</span>
          <input className="input" value={metadata.organization} onChange={(event) => onMetadataChange({ ...metadata, organization: event.target.value })} />
        </label>
        <label className="field">
          <span>License</span>
          <input className="input" value={metadata.license} onChange={(event) => onMetadataChange({ ...metadata, license: event.target.value })} />
        </label>
        <label className="field">
          <span>Tags</span>
          <input className="input" value={metadata.tags} placeholder="hsk, beginner" onChange={(event) => onMetadataChange({ ...metadata, tags: event.target.value })} />
        </label>
      </div>

      <div className="exchange-actions">
        <button className="button secondary" type="button" disabled={exporting || publishing || selectedLessonIds.size === 0} onClick={onBuildPreview}>
          <PackageCheck size={18} />
          {exporting ? "Building..." : "Show preview"}
        </button>
        <button className="button" type="button" disabled={exporting || publishing || selectedLessonIds.size === 0} onClick={onExportSelected}>
          <Download size={18} />
          Export selected
        </button>
        <button className="button secondary" type="button" disabled={exporting || publishing || lessons.length === 0} onClick={onExportAll}>
          Export all
        </button>
        <button className="button secondary" type="button" disabled={exporting || publishing || selectedLessonIds.size === 0} onClick={onPublishSelected}>
          <Upload size={18} />
          {publishing ? "Publishing..." : "Publish selected"}
        </button>
      </div>

      {exportPreview ? (
        <section className="exchange-summary">
          <h3>Export Preview</h3>
          <div className="exchange-stat-row">
            <span><strong>{exportPreview.title}</strong></span>
            <span>{exportPreview.lessons.length} lessons</span>
            <span>{countSentences(exportPreview.lessons)} sentences</span>
            <span>{exportPreview.language} to {exportPreview.baseLanguage}</span>
            <span>{estimatePackSize(exportPreview)}</span>
          </div>
        </section>
      ) : null}
    </section>
  );
}

export function MyPacksSection({
  installedPacks,
  filteredInstalledPacks,
  packLanguages,
  packLevels,
  packSearch,
  packLanguage,
  packLevel,
  onSearchChange,
  onLanguageChange,
  onLevelChange
}: {
  installedPacks: InstalledPackRecord[];
  filteredInstalledPacks: InstalledPackRecord[];
  packLanguages: string[];
  packLevels: string[];
  packSearch: string;
  packLanguage: string;
  packLevel: string;
  onSearchChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onLevelChange: (value: string) => void;
}) {
  return (
    <section className="card stack exchange-section exchange-my-packs" data-tour="exchange-library">
      <div className="exchange-section-heading">
        <Archive size={20} />
        <div>
          <h2>My Packs</h2>
          <p className="muted">Manage installed lesson packs.</p>
        </div>
      </div>

      <div className="exchange-filter-row">
        <label className="exchange-search">
          <Search size={16} />
          <input value={packSearch} placeholder="Search packs" onChange={(event) => onSearchChange(event.target.value)} />
        </label>
        <label className="exchange-select-filter">
          <Filter size={16} />
          <select value={packLanguage} onChange={(event) => onLanguageChange(event.target.value)}>
            <option value="all">All languages</option>
            {packLanguages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </label>
        <select className="input exchange-level-select" value={packLevel} onChange={(event) => onLevelChange(event.target.value)}>
          <option value="all">All levels</option>
          {packLevels.map((level) => <option key={level} value={level}>{level === "none" ? "No level" : level}</option>)}
        </select>
      </div>

      {installedPacks.length === 0 ? (
        <div className="exchange-empty">
          <h3>No installed packs yet</h3>
          <p className="muted">Installed pack metadata will appear here after you preview and install a Fydor Pack.</p>
        </div>
      ) : null}

      <div className="exchange-pack-list">
        {filteredInstalledPacks.map((pack) => (
          <article className="exchange-pack-row" key={`${pack.id}-${pack.installedAt}`}>
            <div className="exchange-pack-row-top">
              <div>
                <h3>{pack.title}</h3>
                <p className="muted">
                  {pack.author || pack.organization ? [pack.author, pack.organization].filter(Boolean).join(", ") : "Unknown author"} · v{pack.version}
                </p>
              </div>
              <span className="pill">{pack.language} to {pack.baseLanguage}</span>
            </div>
            {pack.description ? <p>{pack.description}</p> : null}
            <div className="exchange-stat-row">
              <span>{pack.lessonTitles.length} lessons</span>
              <span>{pack.sentenceCount} sentences</span>
              {pack.level ? <span>{pack.level}</span> : null}
              {pack.license ? <span>{pack.license}</span> : null}
            </div>
            {pack.tags.length ? <div className="inline-tags">{pack.tags.map((tag) => <span className="tag-chip static" key={tag}>{tag}</span>)}</div> : null}
            <details className="exchange-pack-lessons">
              <summary>Lessons in this pack</summary>
              <ul>
                {pack.lessonTitles.map((title) => <li key={title}>{title}</li>)}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}

function PackPreview({
  validation,
  duplicateIndexes,
  selectedLessons,
  duplicateMode,
  installing,
  onToggleLesson,
  onDuplicateModeChange,
  onInstall
}: {
  validation: FydorPackValidation;
  duplicateIndexes: Set<number>;
  selectedLessons: Set<number>;
  duplicateMode: DuplicateMode;
  installing: boolean;
  onToggleLesson: (index: number) => void;
  onDuplicateModeChange: (mode: DuplicateMode) => void;
  onInstall: () => void;
}) {
  const pack = validation.pack;
  if (!pack) return null;
  const canInstall = validation.errors.length === 0 && selectedLessons.size > 0;

  return (
    <section className="exchange-preview">
      <div className="exchange-pack-row-top">
        <div>
          <h3>{pack.title}</h3>
          <p className="muted">{pack.description || "No pack description."}</p>
        </div>
        <span className={`pill ${canInstall ? "status-new" : "status-conflict"}`}>
          {canInstall ? "Ready to install" : "Cannot install"}
        </span>
      </div>

      <div className="exchange-stat-row">
        <span>{pack.author?.name || "Unknown author"}</span>
        <span>v{pack.version}</span>
        {pack.license ? <span>{pack.license}</span> : null}
        <span>{pack.language} to {pack.baseLanguage}</span>
        {pack.level ? <span>{pack.level}</span> : null}
        <span>{validation.lessonCount} lessons</span>
        <span>{validation.sentenceCount} sentences</span>
      </div>

      {pack.tags?.length ? <div className="inline-tags">{pack.tags.map((tag) => <span className="tag-chip static" key={tag}>{tag}</span>)}</div> : null}

      <div className="exchange-validation-list">
        <span className="pill status-new">valid pack structure</span>
        <span className={`pill ${validation.lessonErrors.length ? "status-conflict" : "status-new"}`}>
          {validation.lessonErrors.length ? "lesson schema issues" : "valid lesson schema"}
        </span>
        <span className={duplicateIndexes.size ? "pill status-conflict" : "pill status-new"}>
          {duplicateIndexes.size} duplicate warning{duplicateIndexes.size === 1 ? "" : "s"}
        </span>
      </div>

      {validation.warnings.length ? (
        <div className="notice warn exchange-warning-list">
          <div>{validation.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
        </div>
      ) : null}

      <div className="exchange-duplicate-controls">
        {(["skip", "replace", "keep"] as DuplicateMode[]).map((mode) => (
          <label className="exchange-radio" key={mode}>
            <input type="radio" checked={duplicateMode === mode} onChange={() => onDuplicateModeChange(mode)} />
            <span>{mode === "skip" ? "Skip existing" : mode === "replace" ? "Replace existing" : "Keep both"}</span>
          </label>
        ))}
      </div>

      <div className="exchange-lesson-picker">
        {pack.lessons.map((lesson, index) => (
          <label className="exchange-check-row" key={`${lesson.title}-${index}`}>
            <input type="checkbox" checked={selectedLessons.has(index)} onChange={() => onToggleLesson(index)} />
            <span>
              <strong>{lesson.title}</strong>
              <small>
                {lesson.sentences.length} sentences
                {duplicateIndexes.has(index) ? " · already installed" : ""}
              </small>
            </span>
          </label>
        ))}
      </div>

      <button className="button" type="button" disabled={!canInstall || installing} onClick={onInstall}>
        <PackageCheck size={18} />
        {installing ? "Installing..." : "Install selected lessons"}
      </button>
    </section>
  );
}
