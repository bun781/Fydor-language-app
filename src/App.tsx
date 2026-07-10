import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import LessonImportsPage from "@/components/admin-imports/LessonImportsPage";
import { ExchangeHubPage } from "@/components/exchange/ExchangeHubPage";
import { FydorExchangePage } from "@/components/exchange/FydorExchangePage";
import { ImportedContentWorkspace } from "@/components/imported-content/ImportedContentWorkspace";
import { ReadingWorkspace } from "@/components/reading/ReadingWorkspace";
import { CommunityWorkspace } from "@/components/community/CommunityWorkspace";
import { ErrorBoundary } from "./ErrorBoundary";
import ReviewPage from "./pages/ReviewPage";

// Route table for the whole app. Uses a hash router so the static Tauri build
// (frontendDist serving a single index.html) can deep-link without server rewrites.
export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/lessons/manage" replace />} />
          <Route path="/lessons/manage" element={<LessonImportsPage initialMode="lessons" />} />
          <Route path="/admin/imports" element={<LessonImportsPage />} />
          <Route path="/fydor-exchange" element={<ExchangeHubPage />} />
          <Route path="/fydor-exchange/import" element={<FydorExchangePage />} />
          <Route path="/fydor-exchange/export" element={<FydorExchangePage />} />
          <Route path="/community/contribute" element={<CommunityWorkspace />} />
          <Route path="/community/moderate" element={<Navigate to="/community/contribute?tab=moderate" replace />} />
          <Route path="/community/admin" element={<Navigate to="/community/contribute?tab=admin" replace />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/reading" element={<AppShell><ReadingWorkspace /></AppShell>} />
          <Route path="/study/imported-content" element={<AppShell><ImportedContentWorkspace /></AppShell>} />
          <Route path="/study/fill-blank" element={<AppShell><ImportedContentWorkspace mode="fill-blank" /></AppShell>} />
          <Route path="/study/multiple-choice" element={<AppShell><ImportedContentWorkspace mode="multiple-choice" /></AppShell>} />
          <Route path="/study/sentence-forge" element={<Navigate to="/study/imported-content" replace />} />
          <Route path="*" element={<Navigate to="/lessons/manage" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
