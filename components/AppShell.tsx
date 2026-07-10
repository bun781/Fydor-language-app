import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  HelpCircle,
  Layers3,
  Library,
  PencilRuler,
  RectangleEllipsis,
} from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import fyLogo from "@/Fy.png";
import { GuidedTour, replayGuidedTour } from "@/components/system/GuidedTour";

const navSections: Array<{
  label: string;
  links: Array<{ href: string; label: string; icon: React.ComponentType<{ size?: number }> }>;
}> = [
  {
    label: "Create",
    links: [
      { href: "/admin/imports", label: "Builder", icon: PencilRuler },
      { href: "/lessons/manage", label: "Lessons", icon: Library },
      { href: "/library", label: "Public Library", icon: Library },
      { href: "/fydor-exchange", label: "Fydor Exchange", icon: Boxes }
    ]
  },
  {
    label: "Study",
    links: [
      { href: "/review", label: "Review", icon: ClipboardList },
      { href: "/reading", label: "Reading", icon: FileText },
      { href: "/study/imported-content", label: "Flashcards", icon: Layers3 },
      { href: "/study/fill-blank", label: "Fill Blank", icon: RectangleEllipsis },
      { href: "/study/multiple-choice", label: "Multiple Choice", icon: BookOpen }
    ]
  }
];

const routeTitles: Record<string, string> = {
  "/": "Fydor",
  "/admin/imports": "Builder",
  "/lessons/manage": "Lessons",
  "/library": "Public Library",
  "/fydor-exchange": "Fydor Exchange",
  "/fydor-exchange/import": "Install Pack",
  "/fydor-exchange/export": "Export Pack",
  "/community/contribute": "Contribute",
  "/community/moderate": "Moderate",
  "/community/admin": "Admin",
  "/review": "Review",
  "/reading": "Reading",
  "/study/imported-content": "Flashcards",
  "/study/fill-blank": "Fill Blank",
  "/study/multiple-choice": "Multiple Choice"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const screen = routeTitles[pathname];
    document.title = screen && screen !== "Fydor" ? `${screen} · Fydor` : "Fydor";
  }, [pathname]);

  return (
    <div className="app-shell">
      <Link to="/" className="app-brand" aria-label="Fydor home">
        <img className="app-brand-mark" src={fyLogo} alt="" aria-hidden="true" />
        <span className="app-brand-name">Fydor</span>
      </Link>
      <aside className="sidebar" aria-label="App navigation">
        <nav aria-label="Primary navigation">
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.label}>
              <div className="sidebar-section-label">{section.label}</div>
              {section.links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  title={label}
                  data-tour={href === "/lessons/manage" ? "nav-library" : undefined}
                  className={pathname === href || pathname.startsWith(href + "/") ? "nav-active" : ""}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="icon-button sidebar-help"
          aria-label="Open page guide"
          onClick={() => replayGuidedTour(pathname)}
        >
          <HelpCircle size={17} />
        </button>

        <div className="sidebar-note" aria-label="Project note">
          <span className="pill pill-accent">Free for the people</span>
          <p>Open access by design. No paywall, no subscriptions.</p>
        </div>
      </aside>
      <main className="main">{children}</main>
      <GuidedTour />
    </div>
  );
}
