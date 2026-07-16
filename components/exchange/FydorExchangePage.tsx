import { CheckCircle2, PackageOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { exportLesson, getLessons, importLesson, moveLessonsToPack, openCommunityWorkspace, saveFydorPack, updateLesson, upsertPack } from "@/lib/desktopApi";
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
import { clearLocal, readLocal, readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";
import { InstallPackSection, SharePackSection } from "./ExchangeSections";

export type DuplicateMode = "skip" | "replace" | "keep";

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

const EXCHANGE_PROGRESS_KEY = "fydor.exchange.workspace";
export const EXCHANGE_PACK_DRAFT_KEY = "fydor:exchange-pack-draft";

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
  })
});
type ExchangeProgress = z.infer<typeof exchangeProgressSchema>;

const emptyPackSource = "";

export function FydorExchangePage() {
  const { pathname } = useLocation();
  const isInstallRoute = pathname === "/fydor-exchange/import";
  const isExportRoute = pathname === "/fydor-exchange/export";
  const [savedProgress] = useState(() => readSessionProgress(EXCHANGE_PROGRESS_KEY, exchangeProgressSchema));
  const [lessons, setLessons] = useState<StudyLessonMeta[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
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
  const [openingContributor, setOpeningContributor] = useState(false);
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

  useEffect(() => {
    const downloadedPack = readLocal(EXCHANGE_PACK_DRAFT_KEY, z.string());
    if (!downloadedPack) return;
    clearLocal(EXCHANGE_PACK_DRAFT_KEY);
    setPackSource(downloadedPack);
    const validation = parseFydorPack(downloadedPack);
    setPackPreview(validation);
    if (validation.pack) {
      setSelectedInstallLessons(new Set(validation.pack.lessons.map((_, index) => index)));
      setStatus(validation.errors.length ? "" : "Verified Exchange package ready to install.");
    } else {
      setSelectedInstallLessons(new Set());
      setErrors(validation.errors);
    }
  }, []);

  useEffect(() => {
    refreshLessons();
  }, []);

  useEffect(() => {
    if (lessonsLoading) return;
    setSelectedLessonIds((current) => filterSelectedLessonIds(current, lessons));
  }, [lessons, lessonsLoading]);

  useEffect(() => {
    writeSessionProgress(EXCHANGE_PROGRESS_KEY, {
      packSource,
      duplicateMode,
      selectedInstallLessons: [...selectedInstallLessons],
      installSummary,
      status,
      selectedLessonIds: [...selectedLessonIds],
      metadata
    } satisfies ExchangeProgress);
  }, [duplicateMode, installSummary, metadata, packSource, selectedInstallLessons, selectedLessonIds, status]);

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
    try {
      const packRecord = await upsertPack({
        stableId: pack.id,
        title: pack.title,
        description: pack.description,
        authorName: pack.author?.name,
        organization: pack.author?.organization,
        authorUrl: pack.author?.url,
        language: pack.language,
        baseLanguage: pack.baseLanguage,
        level: pack.level,
        tags: pack.tags,
        version: pack.version,
        license: pack.license,
        sourceType: "exchange"
      });
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
          await moveLessonsToPack([existing.id], packRecord.id);
          summary.replaced += 1;
          summary.sentenceCount += lesson.sentences.length;
          summary.details.push(`Replaced ${lesson.title}.`);
          continue;
        }

        const lessonForImport = existing ? copyLessonTitle(lesson, index) : lesson;
        const result = await importLesson(JSON.stringify(withPackSource(lessonForImport, pack), null, 2));
        if (result.errors.length) throw new Error(result.errors.join("\n"));
        if (result.lessonId) await moveLessonsToPack([result.lessonId], packRecord.id);
        summary.installed += result.lessonCreated || result.sentencesImported > 0 ? 1 : 0;
        summary.sentenceCount += lessonForImport.sentences.length;
        summary.details.push(`Installed ${lessonForImport.title}.`);
      }

      setLessons(await getLessons());

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
    if (lessonsLoading) {
      setErrors(["Lessons are still loading. Try again in a moment."]);
      return null;
    }

    const exportIds = filterSelectedLessonIds(ids, lessons);
    if (!exportIds.size) {
      setErrors(["Select one or more lessons to export."]);
      setSelectedLessonIds(new Set());
      setExportPreview(null);
      return null;
    }

    setExporting(true);
    setErrors([]);
    setStatus("");
    try {
      if (exportIds.size !== ids.size) setSelectedLessonIds(exportIds);
      const exportedLessons = await Promise.all([...exportIds].map((lessonId) => exportLesson(lessonId)));
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
    const savedPath = await saveFydorPack(
      `${slugifyPackTitle(pack.title)}.fydorpack`,
      JSON.stringify(pack, null, 2)
    );
    if (!savedPath) return;
    setStatus(`Exported ${pack.title} to ${savedPath}.`);
  }

  async function openContributorSubmission(ids = selectedLessonIds) {
    const pack = exportPreview && ids === selectedLessonIds ? exportPreview : await buildExportPreview(ids);
    if (!pack) return;
    setOpeningContributor(true);
    setErrors([]);
    setStatus("");
    try {
      const savedPath = await saveFydorPack(
        `${slugifyPackTitle(pack.title)}.fydorpack`,
        JSON.stringify(pack, null, 2)
      );
      if (!savedPath) return;
      await openCommunityWorkspace("contributor");
      setStatus(`Saved ${pack.title}. Upload this exact package in the online contributor workspace for review.`);
    } catch (error) {
      setErrors([errorMessage(error, "Unable to open the contributor workflow.")]);
    } finally {
      setOpeningContributor(false);
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
          <Link className="button secondary" to="/fydor-exchange/import">Install pack</Link>
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

      <div className={`exchange-grid${isInstallRoute || isExportRoute ? " exchange-grid-single" : ""}`}>
        {!isExportRoute ? (
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
        ) : null}
        {!isInstallRoute ? (
          <SharePackSection
            lessons={lessons}
            lessonsLoading={lessonsLoading}
            selectedLessonIds={selectedLessonIds}
            metadata={metadata}
            exporting={exporting}
            publishing={openingContributor}
            exportPreview={exportPreview}
            onSelectAll={selectAllLessons}
            onClearSelection={clearSelectedLessons}
            onToggleLesson={toggleExportLesson}
            onMetadataChange={updateMetadata}
            onBuildPreview={() => void buildExportPreview()}
            onExportSelected={() => void exportSelectedPack()}
            onExportAll={() => void exportSelectedPack(new Set(lessons.map((lesson) => lesson.id)))}
            onPublishSelected={() => void openContributorSubmission()}
          />
        ) : null}
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

export function filterSelectedLessonIds(selectedIds: Set<string>, lessons: Pick<StudyLessonMeta, "id">[]): Set<string> {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  return new Set([...selectedIds].filter((lessonId) => lessonIds.has(lessonId)));
}
