// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

/**
 * CEFR level badge. A single level ("A1") or a range ("A1–A2").
 * The level is always text — colour only reinforces it.
 */
export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted">
      {level}
    </span>
  );
}
