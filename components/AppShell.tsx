import {
  BookOpen,
  Brain,
  Boxes,
  ClipboardList,
  FileText,
  HelpCircle,
  Layers3,
  Library,
  Menu,
  PencilRuler,
  RectangleEllipsis,
  Send,
  ShieldCheck,
  Settings
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import fyLogo from "@/Fy.png";
import { GuidedTour, replayGuidedTour } from "@/components/system/GuidedTour";
import { readSessionProgress, writeSessionProgress } from "@/lib/storage";
import { z } from "zod";

const APP_SHELL_PROGRESS_KEY = "app-shell";

const appShellProgressSchema = z.object({ sidebarPinned: z.boolean() });
type AppShellProgress = z.infer<typeof appShellProgressSchema>;

const navSections: Array<{
  label: string;
  links: Array<{ href: string; label: string; icon: React.ComponentType<{ size?: number }> }>;
}> = [
  {
    label: "Create",
    links: [
      { href: "/admin/imports", label: "Builder", icon: PencilRuler },
      { href: "/lessons/manage", label: "Lessons", icon: Library },
      { href: "/fydor-exchange", label: "Fydor Exchange", icon: Boxes },
      { href: "/community/contribute", label: "Contribute", icon: Send },
      { href: "/community/moderate", label: "Moderate", icon: ShieldCheck },
      { href: "/community/admin", label: "Admin", icon: Settings }
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
  },
  {
    label: "Reference",
    links: [
      { href: "/learning-science", label: "Learning Science", icon: Brain }
    ]
  }
];

const routeTitles: Record<string, string> = {
  "/": "Fydor",
  "/admin/imports": "Builder",
  "/lessons/manage": "Lessons",
  "/fydor-exchange": "Fydor Exchange",
  "/community/contribute": "Contribute",
  "/community/moderate": "Moderate",
  "/community/admin": "Administration",
  "/review": "Review",
  "/reading": "Reading",
  "/study/imported-content": "Flashcards",
  "/study/fill-blank": "Fill Blank",
  "/study/multiple-choice": "Multiple Choice",
  "/learning-science": "Learning Science"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const [sidebarPinned, setSidebarPinned] = useState(() => (
    readSessionProgress(APP_SHELL_PROGRESS_KEY, appShellProgressSchema)?.sidebarPinned ?? false
  ));

  useEffect(() => {
    writeSessionProgress(APP_SHELL_PROGRESS_KEY, { sidebarPinned } satisfies AppShellProgress);
  }, [sidebarPinned]);

  useEffect(() => {
    const screen = routeTitles[pathname];
    document.title = screen && screen !== "Fydor" ? `${screen} · Fydor` : "Fydor";
  }, [pathname]);

  return (
    <div className={`app-shell${sidebarPinned ? " sidebar-pinned" : ""}`}>
      <Link to="/" className="app-brand" aria-label="Fydor home">
        <img className="app-brand-mark" src={fyLogo} alt="" aria-hidden="true" />
        <span className="app-brand-name">Fydor</span>
      </Link>
      <aside className="sidebar" aria-label="App navigation">
        <div className="sidebar-top">
          <button
            type="button"
            className="icon-button sidebar-toggle"
            aria-label={sidebarPinned ? "Collapse navigation" : "Expand navigation"}
            aria-pressed={sidebarPinned}
            onClick={() => setSidebarPinned((current) => !current)}
          >
            <Menu size={19} />
          </button>
        </div>

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
          onClick={() => replayGuidedTour()}
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
