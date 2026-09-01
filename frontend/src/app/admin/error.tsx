"use client";

import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { ApiError } from "@/lib/api";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminError]", error);
  }, [error]);

  const code = error instanceof ApiError ? error.code : "SERVER_ERROR";
  const message = error.message || "An error occurred in the admin panel.";

  return (
    <ErrorDisplay
      code={code}
      message={message}
      errorId={error.digest}
      timestamp={new Date().toISOString()}
      source={process.env.NODE_ENV === "development" ? error.stack : undefined}
      onRetry={reset}
    />
  );
}
