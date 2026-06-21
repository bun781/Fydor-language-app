"use client";

import { useEffect } from "react";
import { PageState } from "@/components/system/PageState";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const details = [error.digest ? `Digest: ${error.digest}` : null, error.stack ?? error.message]
    .filter(Boolean)
    .join("\n\n");

  return (
    <main style={{ padding: 32 }}>
      <PageState
        eyebrow="Server error"
        tone="error"
        title="This page failed to load"
        description="This is the actual error detail from the server render. Use it to diagnose the failure instead of the generic Next.js internal error screen."
        details={details}
        actions={<button className="button" type="button" onClick={reset}>Try again</button>}
      />
    </main>
  );
}
