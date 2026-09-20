// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { ReactNode } from "react";

/**
 * Editorial section opener: uppercase eyebrow, serif headline,
 * optional supporting copy and trailing action.
 */
export function SectionHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-accent uppercase">{eyebrow}</p>
        <h2 className="mt-2 font-serif text-3xl text-balance sm:text-4xl">{title}</h2>
        {children !== undefined ? (
          <div className="mt-3 max-w-2xl text-muted">{children}</div>
        ) : null}
      </div>
      {action !== undefined ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
