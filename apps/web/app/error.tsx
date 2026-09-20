"use client";

// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { useEffect } from "react";
import { Button } from "@/components/button";

/**
 * Route-level error boundary. Plain language and a retry action —
 * developer diagnostics stay in the server logs, not the UI.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto max-w-2xl py-12 text-center">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">
        Something went wrong
      </p>
      <h1 className="mt-3 font-serif text-3xl sm:text-4xl">This page hit a snag.</h1>
      <p className="mx-auto mt-4 max-w-md text-muted">
        Your place is safe — nothing you chose was lost. Try loading it again.
      </p>
      <div className="mt-8 flex justify-center">
        <Button onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}
