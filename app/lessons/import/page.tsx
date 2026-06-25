"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";

export default function LessonImportPage() {
  useEffect(() => {
    window.location.replace("/lessons/manage");
  }, []);

  return (
    <AppShell>
      <section className="card stack">
        <h1>Lesson Import</h1>
        <p className="muted">Opening the lesson manager.</p>
        <a className="button" href="/lessons/manage">Open lesson manager</a>
      </section>
    </AppShell>
  );
}
