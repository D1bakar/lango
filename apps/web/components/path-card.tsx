// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import Link from "next/link";
import { LevelBadge } from "./level-badge";

export type PathCardData = {
  key: string;
  from: string;
  to: string;
  title: string;
  detail: string;
  meta: string;
};

/**
 * Learning path card: origin → target badges, level meta,
 * and a single continuation action.
 */
export function PathCard({ card, href }: { card: PathCardData; href: string }) {
  return (
    <li className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-xs font-bold text-accent-strong">
          {card.from}
        </span>
        <span aria-hidden="true" className="text-faint">
          →
        </span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-xs font-bold text-ink-invert">
          {card.to}
        </span>
        <span className="ml-auto">
          <LevelBadge level={card.meta} />
        </span>
      </div>
      <h3 className="mt-4 font-serif text-xl">{card.title}</h3>
      <p className="mt-2 flex-1 text-sm text-muted">{card.detail}</p>
      <Link
        href={href}
        className="mt-5 text-sm font-medium text-accent-strong group-hover:underline"
      >
        Continue →
      </Link>
    </li>
  );
}
