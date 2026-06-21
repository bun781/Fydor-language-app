"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";

export default function StudyImportRedirectPage() {
  useEffect(() => {
    window.location.replace("/study/imported-content");
  }, []);

  return (
    <AppShell>
      <section className="card stack">
        <h1>Sentence Forge</h1>
        <p className="muted">Opening saved lessons.</p>
        <a className="button" href="/study/imported-content">Open lessons</a>
      </section>
    </AppShell>
  );
}
