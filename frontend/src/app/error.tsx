"use client";

import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorDisplay
          code="SERVER_ERROR"
          message={error.message || "An unexpected error occurred."}
          errorId={error.digest}
          timestamp={new Date().toISOString()}
          source={process.env.NODE_ENV === "development" ? error.stack : undefined}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
