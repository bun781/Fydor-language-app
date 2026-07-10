import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PublicLessonLibrary } from "./PublicLessonLibrary";

export function PublicLibraryPage() {
  return (
    <AppShell>
      <main className="page-shell stack exchange-hub-shell">
        <header className="page-header">
          <div>
            <span className="pill pill-accent">Public library</span>
            <h1>Published lessons</h1>
            <p className="muted">Browse administrator-published lessons and install one into your local library.</p>
          </div>
          <Link className="button secondary" to="/fydor-exchange">Back to Exchange</Link>
        </header>
        <PublicLessonLibrary />
      </main>
    </AppShell>
  );
}
