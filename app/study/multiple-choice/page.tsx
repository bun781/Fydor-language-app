"use client";

import { AppShell } from "@/components/AppShell";
import { ImportedContentWorkspace } from "@/components/imported-content/ImportedContentWorkspace";

export default function MultipleChoicePage() {
  return (
    <AppShell>
      <ImportedContentWorkspace mode="multiple-choice" />
    </AppShell>
  );
}
