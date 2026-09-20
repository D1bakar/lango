// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import { API_BASE_URL, ApiContractError, ApiUnavailableError } from "@/lib/api";

/**
 * The state a developer sees most often: the API is not running.
 *
 * It says which command to run rather than showing a stack trace, because the
 * person reading it is the person who can fix it.
 */
export function ApiDownPanel({ error }: { error: unknown }) {
  const unavailable = error instanceof ApiUnavailableError;
  const contract = error instanceof ApiContractError;

  return (
    <section className="rounded-lg border border-warn/40 bg-warn-soft p-6">
      <h2 className="font-serif text-lg text-ink">
        {unavailable ? "The API is not running" : "The API answered unexpectedly"}
      </h2>

      {unavailable ? (
        <>
          <p className="mt-2 text-sm text-muted">
            This page reads live data from the API at{" "}
            <code className="text-ink">{API_BASE_URL}</code>. Start it in another terminal:
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface px-3 py-2 text-xs text-ink">
            {"pnpm --filter @lingua/api dev"}
          </pre>
          <p className="mt-3 text-sm text-muted">
            Or run both servers together from the repository root with{" "}
            <code className="text-ink">pnpm dev</code>.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          The response did not match the shared schema. That means the API and this client disagree
          about the contract, which is a bug rather than a configuration problem.
        </p>
      )}

      <p className="mt-4 font-mono text-xs break-words text-muted">
        {error instanceof Error ? error.message : String(error)}
      </p>

      {contract ? (
        <p className="mt-3 text-sm text-muted">
          The contract lives in <code className="text-ink">packages/types</code>, and both sides
          validate against it.
        </p>
      ) : null}
    </section>
  );
}
