"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/lessons/manage");
  }, [router]);

  return (
    <AppShell>
      <section className="card stack">
        <h1>Fydor</h1>
        <p className="muted">Opening the lesson manager.</p>
        <a className="button" href="/lessons/manage">Open lesson manager</a>
      </section>
    </AppShell>
  );
}
