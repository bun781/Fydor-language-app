"use client";

import { useEffect } from "react";
import { PageState } from "@/components/system/PageState";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main style={{ padding: 32 }}>
          <PageState
            eyebrow="Application error"
            tone="error"
            title="Fydor could not start"
            description="The app hit an unrecoverable error. The details below are the server-side error report."
            details={details}
            actions={<button className="button" type="button" onClick={reset}>Reload app</button>}
          />
        </main>
      </body>
    </html>
  );
}
