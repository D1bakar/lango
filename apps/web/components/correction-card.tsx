// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * Structured correction display — the product's signature moment.
 *
 * A correction is data (span, category, severity, grounded concept),
 * never prose buried in chat. The "why" reveals the authored rule
 * the correction cites; ungrounded corrections are never rendered
 * by this component.
 */
export function CorrectionCard({
  original,
  corrected,
  explanation,
  conceptKey,
  category,
  severity,
}: {
  original: string;
  corrected: string;
  explanation: string;
  conceptKey: string;
  category: string;
  severity: 1 | 2 | 3;
}) {
  return (
    <article className="animate-correction-in rounded-2xl border border-accent/30 bg-accent-soft/60 p-4 shadow-card sm:p-5">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        Correction · {category} · {severityLabel(severity)}
      </p>
      <p className="mt-3 text-[15px] text-ink">
        <span className="text-muted">You wrote </span>
        <s className="text-red-900 decoration-red-300 decoration-wavy decoration-2">{original}</s>
      </p>
      <p className="mt-1 text-[15px] font-medium text-accent-strong">{corrected}</p>
      <p className="mt-3 text-sm text-ink">{explanation}</p>
      <details className="group mt-3">
        <summary className="cursor-pointer text-sm font-medium text-accent-strong hover:underline">
          Why this rule?
        </summary>
        <p className="mt-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
          Grounded in concept <code className="text-ink">{conceptKey}</code> — written and reviewed
          by a person, cited verbatim.
        </p>
      </details>
    </article>
  );
}

function severityLabel(severity: 1 | 2 | 3): string {
  if (severity === 3) {
    return "blocks meaning";
  }
  if (severity === 2) {
    return "distorts meaning";
  }
  return "minor";
}
