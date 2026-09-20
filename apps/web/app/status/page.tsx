// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { Metadata } from "next";
import { ApiDownPanel } from "@/components/api-down";
import { API_BASE_URL, fetchContentStatus, fetchHealth } from "@/lib/api";

export const metadata: Metadata = {
  title: "Status",
};

export const dynamic = "force-dynamic";

/**
 * What the running process actually loaded.
 *
 * This exists because the most expensive class of bug in a content-driven
 * product is the server quietly serving something other than what the author
 * wrote. Comparing this against `content/` is a five-second check.
 */
export default async function StatusPage() {
  try {
    const [health, content] = await Promise.all([fetchHealth(), fetchContentStatus()]);

    return (
      <div className="max-w-4xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
          Live from the API
        </p>
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl">Status</h1>
        <p className="mt-3 text-muted">
          Read live from the API at <code className="text-ink">{API_BASE_URL}</code>.
        </p>

        <dl className="mt-8 grid gap-3 sm:grid-cols-2">
          <StatusCard label="API" value={health.status} />
          <StatusCard label="Uptime" value={`${Math.round(health.uptime_seconds)}s`} />
          <StatusCard label="Content schema" value={`v${content.schema_version}`} />
          <StatusCard label="Languages defined" value={String(content.languages)} />
          <StatusCard label="Grading profiles" value={String(content.normalization_profiles)} />
          <StatusCard label="Language packs" value={String(content.packs)} />
          <StatusCard label="Packs published" value={String(content.packs_published)} />
        </dl>

        {content.packs_published === 0 ? (
          <p className="mt-6 text-sm text-muted">
            No pack is published yet, which is expected at this stage. Content validation refuses to
            publish a pack that has no fluent reviewer, so lessons stay unplayable until one is
            recorded.
          </p>
        ) : null}
      </div>
    );
  } catch (error) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-serif text-3xl">Status</h1>
        <div className="mt-8">
          <ApiDownPanel error={error} />
        </div>
      </div>
    );
  }
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
      <dt className="text-xs tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-1 font-serif text-2xl text-ink">{value}</dd>
    </div>
  );
}
