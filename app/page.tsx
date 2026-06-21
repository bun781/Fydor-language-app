"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  useEffect(() => {
    window.location.replace("/admin/imports");
  }, []);

  return (
    <AppShell>
      <section className="card stack">
        <h1>Fydor</h1>
        <p className="muted">Opening the lesson importer.</p>
        <a className="button" href="/admin/imports">Open importer</a>
      </section>
    </AppShell>
  );
}
