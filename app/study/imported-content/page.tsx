import { AppShell } from "@/components/AppShell";
import { ImportedContentStudy } from "@/components/imported-content/ImportedContentStudy";
import { getAllLessonsMeta, getLessonContentById } from "@/lib/language/importedContent";

export const dynamic = "force-dynamic";

export default async function ImportedContentPage() {
  const allLessons = await getAllLessonsMeta();
  const latestLesson = allLessons[0] ? await getLessonContentById(allLessons[0].id) : null;

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Imported Content</h1>
          <p className="muted">Study imported lessons one sentence at a time.</p>
        </div>
        {latestLesson ? (
          <span className="pill">{latestLesson.language.toUpperCase()} → {latestLesson.baseLanguage.toUpperCase()}</span>
        ) : null}
      </div>

      <ImportedContentStudy lesson={latestLesson} allLessons={allLessons} />
    </AppShell>
  );
}
