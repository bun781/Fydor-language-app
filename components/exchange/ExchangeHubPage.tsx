import { Boxes, Download, Send, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PublicLessonLibrary } from "./PublicLessonLibrary";

export function ExchangeHubPage() {
  return (
    <AppShell>
      <main className="page-shell stack exchange-hub-shell">
        <header className="page-header">
          <div>
            <span className="pill pill-accent">Fydor Exchange</span>
            <h1>Move lessons between create, share, and contribute</h1>
            <p className="muted">Pick the path you need. Import published lessons, export your own pack, or jump into the community contributor workflow.</p>
          </div>
        </header>

        <div className="exchange-actions">
          <Link className="button secondary" to="/fydor-exchange/import">Install pack</Link>
          <Link className="button secondary" to="/fydor-exchange/export">Export back</Link>
          <Link className="button secondary" to="/community/contribute">Contribute</Link>
        </div>

        <PublicLessonLibrary />

        <section className="grid grid-3 exchange-hub-grid">
          <article className="card stack exchange-hub-card">
            <div className="exchange-section-heading">
              <Upload size={20} />
              <div>
                <h2>Install Pack</h2>
                <p className="muted">Open the install pack screen and bring in a published lesson or shared pack.</p>
              </div>
            </div>
            <Link className="button" to="/fydor-exchange/import">
              <Download size={18} />
              Go to install
            </Link>
          </article>

          <article className="card stack exchange-hub-card">
            <div className="exchange-section-heading">
              <Boxes size={20} />
              <div>
                <h2>Export Pack</h2>
                <p className="muted">Build a Fydor Pack from your lessons, preview it, and publish or download it.</p>
              </div>
            </div>
            <Link className="button" to="/fydor-exchange/export">
              <Download size={18} />
              Go to export
            </Link>
          </article>

          <article className="card stack exchange-hub-card">
            <div className="exchange-section-heading">
              <Send size={20} />
              <div>
                <h2>Contribute</h2>
                <p className="muted">Write a lesson, review every sentence, and open moderation or admin panels when your account can access them.</p>
              </div>
            </div>
            <Link className="button" to="/community/contribute">
              <Send size={18} />
              Open contribute
            </Link>
          </article>
        </section>
      </main>
    </AppShell>
  );
}
