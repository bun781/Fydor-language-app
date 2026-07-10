import { Boxes, Download, Globe2, Send, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell } from "@/components/AppShell";

export function ExchangeHubPage() {
  return (
    <AppShell>
      <main className="page-shell stack exchange-hub-shell">
        <header className="page-header">
          <div>
            <span className="pill pill-accent">Fydor Exchange</span>
            <h1>Move lessons between create, share, and contribute</h1>
            <p className="muted">Pick the path you need. Browse published lessons, install or share packs, or contribute a lesson to the community.</p>
          </div>
        </header>

        <div className="exchange-actions">
          <Link className="button secondary" to="/fydor-exchange/import">Install pack</Link>
          <Link className="button secondary" to="/fydor-exchange/export">Share pack</Link>
          <Link className="button secondary" to="/library">Public library</Link>
          <Link className="button secondary" to="/community/contribute">Contribute</Link>
        </div>

        <section className="grid grid-4 exchange-hub-grid">
          <article className="card stack exchange-hub-card" data-tour="exchange-hub-library">
            <div className="exchange-section-heading">
              <Globe2 size={20} />
              <div>
                <h2>Public Library</h2>
                <p className="muted">Browse published lessons and send one directly to the install screen.</p>
              </div>
            </div>
            <Link className="button" to="/library">
              <Globe2 size={18} />
              Browse library
            </Link>
          </article>

          <article className="card stack exchange-hub-card" data-tour="exchange-hub-install">
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

          <article className="card stack exchange-hub-card" data-tour="exchange-hub-share">
            <div className="exchange-section-heading">
              <Boxes size={20} />
              <div>
                <h2>Share Pack</h2>
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
