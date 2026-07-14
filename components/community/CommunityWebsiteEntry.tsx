import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { openCommunityWorkspace } from "@/lib/desktopApi";

type CommunityDestination = "contributor" | "moderate" | "admin";

const DESTINATION_LABELS: Record<CommunityDestination, { title: string; description: string }> = {
  contributor: {
    title: "Contributor workspace",
    description: "Fydor's online contributor workflow is opening in a Fydor window. Sign in there to create, review, and submit a pack."
  },
  moderate: {
    title: "Moderation workspace",
    description: "Fydor's online moderation workflow is opening in a Fydor window. Your role and language assignments are checked there."
  },
  admin: {
    title: "Administration workspace",
    description: "Fydor's online administration workflow is opening in a Fydor window. Your administrator permissions are checked there."
  }
};

export function CommunityWebsiteEntry({ destination }: { destination: CommunityDestination }) {
  const [status, setStatus] = useState("Opening the Fydor website...");
  const content = DESTINATION_LABELS[destination];

  const openWebsite = useCallback(async () => {
    try {
      setStatus("Opening the Fydor website...");
      await openCommunityWorkspace(destination);
      setStatus("The online workspace is open in a Fydor window.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to open the Fydor website.");
    }
  }, [destination]);

  useEffect(() => {
    void openWebsite();
  }, [openWebsite]);

  return (
    <AppShell>
      <main className="page-shell stack community-shell">
        <header className="page-header">
          <div>
            <span className="pill">Online workspace</span>
            <h1>{content.title}</h1>
            <p className="muted">{content.description}</p>
          </div>
          <button className="button secondary" type="button" onClick={() => void openWebsite()}>
            <RefreshCw size={16} />
            Open again
          </button>
        </header>
        <section className="card stack community-auth">
          <ExternalLink size={24} aria-hidden="true" />
          <p className="muted">{status}</p>
          <p className="muted">The website keeps your sign-in in an HttpOnly session cookie and owns the contributor workflow for both Fydor surfaces.</p>
        </section>
      </main>
    </AppShell>
  );
}
