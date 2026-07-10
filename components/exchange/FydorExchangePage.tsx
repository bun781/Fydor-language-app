import { CheckCircle2, PackageOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { exportLesson, getLessons, importLesson, updateLesson } from "@/lib/desktopApi";
import { errorMessage } from "@/lib/errors";
import {
  createFydorPack,
  lessonKey,
  parseFydorPack,
  slugifyPackTitle,
  type FydorPack,
  type FydorPackValidation
} from "@/lib/fydor-pack";
import type { StudyLessonMeta } from "@/lib/imported-content/types";
import type { LessonImportInput } from "@/lib/language/types";
import { publishFydorPack } from "@/lib/public-library";
import { readLocal, readSessionProgress, writeLocal, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";
import { InstallPackSection, MyPacksSection, SharePackSection } from "./ExchangeSections";
import { PublicLessonLibrary } from "./PublicLessonLibrary";

export type DuplicateMode = "skip" | "replace" | "keep";

export interface InstalledPackRecord {
  id: string;
  title: string;
  description?: string;
  author?: string;
  organization?: string;
  version: string;
  license?: string;
  language: string;
  baseLanguage: string;
  level?: string;
  tags: string[];
  installedAt: string;
  lessonTitles: string[];
  lessonIds: string[];
  sentenceCount: number;
}

export interface ExchangePackMetadata {
  title: string;
  description: string;
  author: string;
  organization: string;
  version: string;
  license: string;
  tags: string;
}

const installSummarySchema = z.object({
  installed: z.number(),
  skipped: z.number(),
  replaced: z.number(),
  sentenceCount: z.number(),
  details: z.array(z.string())
});
export type InstallSummary = z.infer<typeof installSummarySchema>;

const INSTALLED_PACKS_KEY = "fydor.exchange.installedPacks.v1";
const EXCHANGE_PROGRESS_KEY = "fydor.exchange.workspace";

const installedPacksSchema = z.array(z.custom<InstalledPackRecord>((value) => (
  Boolean(value) && typeof value === "object"
)));

const exchangeProgressSchema = z.object({
  packSource: z.string(),
  duplicateMode: z.enum(["skip", "replace", "keep"]),
  selectedInstallLessons: z.array(z.number().int()),
  installSummary: installSummarySchema.nullish().transform((value) => value ?? null),
  status: z.string(),
  selectedLessonIds: z.array(z.string()),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    organization: z.string(),
    version: z.string(),
    license: z.string(),
    tags: z.string()
  }),
  packSearch: z.string(),
  packLanguage: z.string(),
  packLevel: z.string()
});
type ExchangeProgress = z.infer<typeof exchangeProgressSchema>;

const emptyPackSource = "";

export function FydorExchangePage() {
  const [savedProgress] = useState(() => readSessionProgress(EXCHANGE_PROGRESS_KEY, exchangeProgressSchema));
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [installedPacks, setInstalledPacks] = useState<InstalledPackRecord[]>([]);
  const [packSource, setPackSource] = useState(savedProgress?.packSource ?? emptyPackSource);
  const [packPreview, setPackPreview] = useState<FydorPackValidation | null>(() => (
    savedProgress?.packSource ? parseFydorPack(savedProgress.packSource) : null
  ));
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>(savedProgress?.duplicateMode ?? "skip");
  const [selectedInstallLessons, setSelectedInstallLessons] = useState<Set<number>>(() => (
    new Set(savedProgress?.selectedInstallLessons ?? [])
  ));
  const [installing, setInstalling] = useState(false);
  const [installSummary, setInstallSummary] = useState<InstallSummary | null>(savedProgress?.installSummary ?? null);
  const [status, setStatus] = useState(savedProgress?.status ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => (
    new Set(savedProgress?.selectedLessonIds ?? [])
  ));
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exportPreview, setExportPreview] = useState<FydorPack | null>(null);
  const [metadata, setMetadata] = useState<ExchangePackMetadata>(savedProgress?.metadata ?? {
    title: "My Fydor Pack",
    description: "",
    author: "",
    organization: "",
    version: "1.0.0",
    license: "CC BY",
    tags: ""
  });
  const [packSearch, setPackSearch] = useState(savedProgress?.packSearch ?? "");
  const [packLanguage, setPackLanguage] = useState(savedProgress?.packLanguage ?? "all");
  const [packLevel, setPackLevel] = useState(savedProgress?.packLevel ?? "all");

  useEffect(() => {
    refreshLessons();
    setInstalledPacks(readInstalledPacks());
  }, []);

  useEffect(() => {
    writeSessionProgress(EXCHANGE_PROGRESS_KEY, {
      packSource,
      duplicateMode,
      selectedInstallLessons: [...selectedInstallLessons],
      installSummary,
      status,
      selectedLessonIds: [...selectedLessonIds],
      metadata,
      packSearch,
      packLanguage,
      packLevel
    } satisfies ExchangeProgress);
  }, [duplicateMode, installSummary, metadata, packLanguage, packLevel, packSearch, packSource, selectedInstallLessons, selectedLessonIds, status]);

  const existingLessonByKey = useMemo(() => {
    const map = new Map<string, StudyLessonMeta>();
    lessons.forEach((lesson) => {
      map.set(lessonKey({
        title: lesson.title,
        language: lesson.language,
        baseLanguage: lesson.baseLanguage
      }), lesson);
    });
    return map;
  }, [lessons]);

  const duplicateIndexes = useMemo(() => {
    const duplicates = new Set<number>();
    packPreview?.pack?.lessons.forEach((lesson, index) => {
      if (existingLessonByKey.has(lessonKey(lesson))) duplicates.add(index);
    });
    return duplicates;
  }, [existingLessonByKey, packPreview]);

  const filteredInstalledPacks = useMemo(() => {
    const query = packSearch.trim().toLowerCase();
    return installedPacks.filter((pack) => {
      const matchesQuery = !query || [
        pack.title,
        pack.author,
        pack.organization,
        pack.tags.join(" "),
        pack.lessonTitles.join(" ")
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesLanguage = packLanguage === "all" || pack.language === packLanguage;
      const matchesLevel = packLevel === "all" || (pack.level ?? "none") === packLevel;
      return matchesQuery && matchesLanguage && matchesLevel;
    });
  }, [installedPacks, packLanguage, packLevel, packSearch]);

  const packLanguages = Array.from(new Set(installedPacks.map((pack) => pack.language))).sort();
  const packLevels = Array.from(new Set(installedPacks.map((pack) => pack.level ?? "none"))).sort();

  async function refreshLessons() {
    setLessonsLoading(true);
    try {
      setLessons(await getLessons());
    } catch (error) {
      setErrors([errorMessage(error, "Unable to load lessons.")]);
    } finally {
      setLessonsLoading(false);
    }
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    setPackSource(text);
    previewPack(text);
  }

  function updatePackSource(value: string) {
    setPackSource(value);
    setPackPreview(null);
    setInstallSummary(null);
  }

  function previewPack(source = packSource) {
    setErrors([]);
    setStatus("");
    setInstallSummary(null);
    const validation = parseFydorPack(source);
    setPackPreview(validation);
    if (validation.pack) {
      setSelectedInstallLessons(new Set(validation.pack.lessons.map((_, index) => index)));
      setStatus(validation.errors.length ? "" : "Pack preview ready.");
    } else {
      setSelectedInstallLessons(new Set());
      setErrors(validation.errors);
    }
  }

  function toggleInstallLesson(index: number) {
    setSelectedInstallLessons((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function installSelectedLessons() {
    const pack = packPreview?.pack;
    if (!pack) return;

    const lessonsToInstall = pack.lessons
      .map((lesson, index) => ({ lesson, index }))
      .filter((item) => selectedInstallLessons.has(item.index));

    if (!lessonsToInstall.length) {
      setErrors(["Select at least one lesson to install."]);
      return;
    }

    setInstalling(true);
    setErrors([]);
    setStatus("");
    setInstallSummary(null);

    const summary: InstallSummary = {
      installed: 0,
      skipped: 0,
      replaced: 0,
      sentenceCount: 0,
      details: []
    };
    const installedLessonTitles: string[] = [];
    const installedLessonIds: string[] = [];

    try {
      for (const { lesson, index } of lessonsToInstall) {
        const existing = existingLessonByKey.get(lessonKey(lesson));
        if (existing && duplicateMode === "skip") {
          summary.skipped += 1;
          summary.details.push(`Skipped ${lesson.title}.`);
          continue;
        }

        if (existing && duplicateMode === "replace") {
          const result = await updateLesson(existing.id, JSON.stringify(withPackSource(lesson, pack), null, 2));
          if (result.errors.length) throw new Error(result.errors.join("\n"));
          summary.replaced += 1;
          summary.sentenceCount += lesson.sentences.length;
          summary.details.push(`Replaced ${lesson.title}.`);
          installedLessonTitles.push(lesson.title);
          installedLessonIds.push(existing.id);
          continue;
        }

        const lessonForImport = existing ? copyLessonTitle(lesson, index) : lesson;
        const result = await importLesson(JSON.stringify(withPackSource(lessonForImport, pack), null, 2));
        if (result.errors.length) throw new Error(result.errors.join("\n"));
        summary.installed += result.lessonCreated || result.sentencesImported > 0 ? 1 : 0;
        summary.sentenceCount += lessonForImport.sentences.length;
        summary.details.push(`Installed ${lessonForImport.title}.`);
        installedLessonTitles.push(lessonForImport.title);
      }

      const refreshedLessons = await getLessons();
      setLessons(refreshedLessons);
      const refreshedByKey = new Map(refreshedLessons.map((lesson) => [
        lessonKey({ title: lesson.title, language: lesson.language, baseLanguage: lesson.baseLanguage }),
        lesson
      ]));
      installedLessonIds.push(...installedLessonTitles
        .map((title) => refreshedByKey.get(lessonKey({ title, language: pack.language, baseLanguage: pack.baseLanguage }))?.id)
        .filter((id): id is string => Boolean(id)));

      if (installedLessonTitles.length) {
        const nextPacks = upsertInstalledPack(installedPacks, {
          id: pack.id,
          title: pack.title,
          description: pack.description,
          author: pack.author?.name,
          organization: pack.author?.organization,
          version: pack.version,
          license: pack.license,
          language: pack.language,
          baseLanguage: pack.baseLanguage,
          level: pack.level,
          tags: pack.tags ?? [],
          installedAt: new Date().toISOString(),
          lessonTitles: Array.from(new Set(installedLessonTitles)),
          lessonIds: Array.from(new Set(installedLessonIds)),
          sentenceCount: summary.sentenceCount
        });
        setInstalledPacks(nextPacks);
        writeInstalledPacks(nextPacks);
      }

      setInstallSummary(summary);
      setStatus("Pack install complete.");
      setPackSource("");
      setPackPreview(null);
      setSelectedInstallLessons(new Set());
    } catch (error) {
      setErrors([errorMessage(error, "Unable to install this pack.")]);
    } finally {
      setInstalling(false);
    }
  }

  function toggleExportLesson(lessonId: string) {
    setSelectedLessonIds((current) => {
      const next = new Set(current);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
    setExportPreview(null);
  }

  function selectAllLessons() {
    setSelectedLessonIds(new Set(lessons.map((lesson) => lesson.id)));
    setExportPreview(null);
  }

  function clearSelectedLessons() {
    setSelectedLessonIds(new Set());
    setExportPreview(null);
  }

  function updateMetadata(nextMetadata: ExchangePackMetadata) {
    setMetadata(nextMetadata);
    setExportPreview(null);
  }

  async function buildExportPreview(ids = selectedLessonIds) {
    if (!ids.size) {
      setErrors(["Select one or more lessons to export."]);
      return null;
    }

    setExporting(true);
    setErrors([]);
    setStatus("");
    try {
      const exportedLessons = await Promise.all([...ids].map((lessonId) => exportLesson(lessonId)));
      const pack = createFydorPack({
        title: metadata.title,
        description: metadata.description,
        author: {
          name: metadata.author,
          organization: metadata.organization
        },
        version: metadata.version,
        license: metadata.license,
        tags: splitTags(metadata.tags),
        lessons: exportedLessons
      });
      setExportPreview(pack);
      setStatus("Export preview ready.");
      return pack;
    } catch (error) {
      setErrors([errorMessage(error, "Unable to export lessons.")]);
      return null;
    } finally {
      setExporting(false);
    }
  }

  async function exportSelectedPack(ids = selectedLessonIds) {
    const pack = exportPreview && ids === selectedLessonIds ? exportPreview : await buildExportPreview(ids);
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugifyPackTitle(pack.title)}.fydorpack`;
    link.click();
    window.URL.revokeObjectURL(url);
    setStatus(`Exported ${pack.title}.`);
  }

  async function publishSelectedPack(ids = selectedLessonIds) {
    const pack = exportPreview && ids === selectedLessonIds ? exportPreview : await buildExportPreview(ids);
    if (!pack) return;
    setPublishing(true);
    setErrors([]);
    setStatus("");
    try {
      const result = await publishFydorPack(pack);
      setStatus(`Published ${result.pack.title} to ${result.bucket}/${result.path}.`);
    } catch (error) {
      setErrors([errorMessage(error, "Unable to publish this pack.")]);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Fydor Exchange</h1>
          <p className="muted">Import, share, and manage lesson packs.</p>
        </div>
        <div className="exchange-actions">
          <Link className="button secondary" to="/fydor-exchange">Exchange home</Link>
          <Link className="button secondary" to="/fydor-exchange/import">Import pack</Link>
          <Link className="button secondary" to="/community/contribute">Contribute</Link>
        </div>
      </div>

      {errors.length ? (
        <section className="card error-card exchange-status-card" role="alert">
          <PackageOpen size={18} />
          <div>
            {errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        </section>
      ) : null}
      {status ? (
        <section className="card success-card exchange-status-card">
          <CheckCircle2 size={18} />
          <p>{status}</p>
        </section>
      ) : null}

      <div className="exchange-grid">
        <PublicLessonLibrary />
        <InstallPackSection
          packSource={packSource}
          packPreview={packPreview}
          duplicateIndexes={duplicateIndexes}
          selectedInstallLessons={selectedInstallLessons}
          duplicateMode={duplicateMode}
          installing={installing}
          installSummary={installSummary}
          onReadFile={readFile}
          onPreviewPack={() => previewPack()}
          onPackSourceChange={updatePackSource}
          onToggleLesson={toggleInstallLesson}
          onDuplicateModeChange={setDuplicateMode}
          onInstall={installSelectedLessons}
        />
        <SharePackSection
          lessons={lessons}
          lessonsLoading={lessonsLoading}
          selectedLessonIds={selectedLessonIds}
          metadata={metadata}
          exporting={exporting}
          publishing={publishing}
          exportPreview={exportPreview}
          onSelectAll={selectAllLessons}
          onClearSelection={clearSelectedLessons}
          onToggleLesson={toggleExportLesson}
          onMetadataChange={updateMetadata}
          onBuildPreview={() => void buildExportPreview()}
          onExportSelected={() => void exportSelectedPack()}
          onExportAll={() => void exportSelectedPack(new Set(lessons.map((lesson) => lesson.id)))}
          onPublishSelected={() => void publishSelectedPack()}
        />
        <MyPacksSection
          installedPacks={installedPacks}
          filteredInstalledPacks={filteredInstalledPacks}
          packLanguages={packLanguages}
          packLevels={packLevels}
          packSearch={packSearch}
          packLanguage={packLanguage}
          packLevel={packLevel}
          onSearchChange={setPackSearch}
          onLanguageChange={setPackLanguage}
          onLevelChange={setPackLevel}
        />
      </div>
    </AppShell>
  );
}

function withPackSource(lesson: LessonImportInput, pack: FydorPack): LessonImportInput {
  return {
    ...lesson,
    source: `Fydor Pack: ${pack.title} (${pack.id}@${pack.version})`
  };
}

function copyLessonTitle(lesson: LessonImportInput, index: number): LessonImportInput {
  return {
    ...lesson,
    title: `${lesson.title} (Pack copy ${index + 1})`
  };
}

function splitTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function readInstalledPacks(): InstalledPackRecord[] {
  return readLocal(INSTALLED_PACKS_KEY, installedPacksSchema) ?? [];
}

function writeInstalledPacks(packs: InstalledPackRecord[]) {
  writeLocal(INSTALLED_PACKS_KEY, packs);
}

function upsertInstalledPack(packs: InstalledPackRecord[], nextPack: InstalledPackRecord): InstalledPackRecord[] {
  const existing = packs.filter((pack) => pack.id !== nextPack.id);
  return [nextPack, ...existing];
}
