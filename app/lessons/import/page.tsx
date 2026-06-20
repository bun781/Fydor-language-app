"use client";

import { FileJson, Upload } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ImportPreview } from "@/components/language/ImportPreview";
import type { ImportPreviewResult } from "@/lib/language/types";

export default function LessonImportPage() {
  const [source, setSource] = useState(sampleLesson);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function previewLesson() {
    setLoading(true);
    setErrors([]);
    setStatus("");
    const result = await fetch("/api/lessons/import/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const data = await result.json() as { preview?: ImportPreviewResult; errors?: string[]; error?: string };
    setLoading(false);

    if (!result.ok || !data.preview) {
      setPreview(null);
      setErrors(data.errors ?? [data.error ?? "Unable to preview lesson."]);
      return;
    }

    setPreview(data.preview);
  }

  async function importLesson() {
    setImporting(true);
    setStatus("");
    const result = await fetch("/api/lessons/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source })
    });
    const data = await result.json() as { result?: { sentenceCount: number }; error?: string; errors?: string[] };
    setImporting(false);

    if (!result.ok) {
      setErrors(data.errors ?? [data.error ?? "Unable to import lesson."]);
      return;
    }

    setPreview(null);
    setStatus(`Imported ${data.result?.sentenceCount ?? 0} sentences.`);
  }

  async function readFile(file: File | undefined) {
    if (!file) return;
    setSource(await file.text());
    setPreview(null);
    setErrors([]);
    setStatus("");
  }

  return (
    <AppShell>
      <div className="topbar">
        <div>
          <h1>Lesson Import</h1>
          <p className="muted">Validate, preview, approve, then generate Sentence Forge drills.</p>
        </div>
        <label className="button secondary">
          <FileJson size={18} />
          Upload
          <input className="hidden-input" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
        </label>
      </div>

      <section className="card stack">
        <textarea className="input code-input" value={source} onChange={(event) => setSource(event.target.value)} aria-label="Lesson JSON" />
        <div className="row">
          <button className="button secondary" type="button" onClick={() => {
            setPreview(null);
            setErrors([]);
            setStatus("");
          }}>
            Skip
          </button>
          <button className="button" type="button" disabled={loading} onClick={previewLesson}>
            <Upload size={18} />
            {loading ? "Checking" : "Preview"}
          </button>
        </div>
      </section>

      {errors.length ? (
        <section className="card stack error-card">
          <h2>Validation Error</h2>
          {errors.map((error) => <p key={error}>{error}</p>)}
        </section>
      ) : null}

      {status ? <section className="card success-card">{status}</section> : null}

      {preview ? (
        <div className="import-preview-wrap">
          <ImportPreview
            preview={preview}
            importing={importing}
            onApprove={importLesson}
            onCancel={() => setPreview(null)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}

const sampleLesson = `{
  "targetLanguage": "ja",
  "baseLanguage": "en",
  "level": "A1",
  "title": "Basic wants",
  "sentences": [
    {
      "text": "寿司を食べたい。",
      "translation": "I want to eat sushi.",
      "focus": {
        "type": "grammar",
        "canonicalKey": "ja:grammar:tai_want_to",
        "displayText": "〜たい",
        "meaning": "want to do",
        "explanation": "Verb stem + たい expresses wanting to do something."
      },
      "tokens": [
        {
          "text": "寿司",
          "type": "word",
          "canonicalKey": "ja:word:寿司:noun",
          "meaning": "sushi"
        },
        {
          "text": "を",
          "type": "grammar",
          "canonicalKey": "ja:grammar:object_marker_wo",
          "meaning": "object marker"
        },
        {
          "text": "食べたい",
          "type": "grammar",
          "canonicalKey": "ja:grammar:tai_want_to",
          "meaning": "want to eat"
        }
      ],
      "drills": {
        "recallPrompt": "How do you say: I want to eat sushi?",
        "clozePrompt": "寿司を____。",
        "clozeAnswer": "食べたい",
        "transformPrompt": "Change this to: I don't want to eat sushi.",
        "transformAnswer": "寿司を食べたくない。"
      }
    }
  ]
}`;
