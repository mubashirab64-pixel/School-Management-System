"use client";

import { useEffect } from "react";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { ApiError } from "@/lib/api";

export default function AccountsOfficerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AccountsOfficerError]", error);
  }, [error]);

  const code = error instanceof ApiError ? error.code : "SERVER_ERROR";

  return (
    <ErrorDisplay
      code={code}
      message={error.message || "An error occurred in the accounts portal."}
      errorId={error.digest}
      timestamp={new Date().toISOString()}
      source={process.env.NODE_ENV === "development" ? error.stack : undefined}
      onRetry={reset}
    />
  );
}
