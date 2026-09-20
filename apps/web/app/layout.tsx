// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lingua",
    template: "%s · Lingua",
  },
  description:
    "A structured language curriculum with an AI mentor that knows what you have learned and what you keep getting wrong.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <div className="border-b border-line bg-ink text-[13px] text-ink-invert">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-2">
            <p className="truncate">
              Preview build — the catalog is live, lessons and accounts are not built yet.
            </p>
            <Link href="/status" className="hidden shrink-0 underline underline-offset-4 sm:inline">
              Check live status
            </Link>
          </div>
        </div>

        <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-serif text-lg text-white"
              >
                L
              </span>
              <span className="leading-tight">
                <span className="block font-serif text-lg tracking-tight text-ink">Lingua</span>
                <span className="block text-[11px] tracking-wide text-muted uppercase">
                  AI-mentored learning
                </span>
              </span>
            </Link>
            <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-muted lg:flex">
              <Link href="/learn" className="hover:text-ink">
                Find your path
              </Link>
              <Link href="/placement" className="hover:text-ink">
                Placement
              </Link>
              <Link href="/#how" className="hover:text-ink">
                How it works
              </Link>
              <Link href="/#paths" className="hover:text-ink">
                Curriculum
              </Link>
              <Link href="/#method" className="hover:text-ink">
                Method
              </Link>
              <Link href="/status" className="hover:text-ink">
                Status
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link
                href="/status"
                className="hidden rounded-md border border-line px-4 py-2 text-sm text-ink hover:bg-surface sm:inline-block"
              >
                Live status
              </Link>
              <Link
                href="/learn"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Start learning
              </Link>
            </div>
          </div>
          <nav aria-label="Sections" className="border-t border-line/70 lg:hidden">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-6 overflow-x-auto px-5 py-2 text-sm text-muted">
              <Link href="/learn" className="shrink-0 hover:text-ink">
                Find your path
              </Link>
              <Link href="/placement" className="shrink-0 hover:text-ink">
                Placement
              </Link>
              <Link href="/#how" className="shrink-0 hover:text-ink">
                How it works
              </Link>
              <Link href="/#paths" className="shrink-0 hover:text-ink">
                Curriculum
              </Link>
              <Link href="/#method" className="shrink-0 hover:text-ink">
                Method
              </Link>
              <Link href="/status" className="shrink-0 hover:text-ink">
                Status
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:py-14">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="flex items-center gap-2 font-serif text-lg text-ink">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-base text-white"
                >
                  L
                </span>
                Lingua
              </p>
              <p className="mt-3 max-w-sm text-sm text-muted">
                A structured curriculum with an AI mentor that knows what you have learned, what is
                fading, and what you keep getting wrong.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/learn"
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                >
                  Choose a language
                </Link>
                <Link
                  href="/status"
                  className="rounded-md border border-line px-4 py-2 text-sm text-ink hover:bg-canvas"
                >
                  See what is running
                </Link>
              </div>
            </div>
            <FooterColumn
              title="Start"
              links={[
                { href: "/learn", label: "Find your path" },
                { href: "/#paths", label: "Curriculum" },
                { href: "/#level", label: "Check your level" },
              ]}
            />
            <FooterColumn
              title="Product"
              links={[
                { href: "/#how", label: "How it works" },
                { href: "/#method", label: "Teaching method" },
                { href: "/#contribute", label: "Contribute content" },
              ]}
            />
            <FooterColumn
              title="Project"
              links={[
                { href: "/status", label: "Live status" },
                { href: "/learn", label: "Onboarding" },
                { href: "/", label: "Preview home" },
              ]}
            />
          </div>
          <div className="border-t border-line">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>Preview build. There are no accounts yet, and nothing you choose is saved.</p>
              <p>Lingua is a working name.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h2 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.label}>
            <Link href={link.href} className="text-ink hover:text-accent-strong hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
