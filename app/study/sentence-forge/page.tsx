import { AppShell } from "@/components/AppShell";
import { SentenceForge } from "@/components/language/SentenceForge";
import { getNextSentenceForgeItem } from "@/lib/language/studyQueue";

export const dynamic = "force-dynamic";

export default async function SentenceForgePage() {
  let item = null;
  let error = "";

  try {
    item = await getNextSentenceForgeItem();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Unable to load Sentence Forge.";
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Sentence Forge</h1>
          <p className="muted">Example, recall, rebuild, cloze, transform, original sentence, self grade.</p>
        </div>
      </div>
      {error ? <section className="card error-card">{error}</section> : <SentenceForge initialItem={item} />}
    </AppShell>
  );
}
