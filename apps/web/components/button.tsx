// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Lingua contributors

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white shadow-lift hover:bg-accent-strong",
  secondary: "border border-line bg-surface text-ink shadow-card hover:border-line-strong",
  ghost: "text-accent-strong hover:underline",
};

function buttonClass(variant: ButtonVariant, className?: string): string {
  const base =
    "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50";
  return className === undefined
    ? `${base} ${VARIANT_STYLES[variant]}`
    : `${base} ${VARIANT_STYLES[variant]} ${className}`;
}

/**
 * Action button. Three tiers only: primary (one per screen),
 * secondary (safe alternatives), ghost (inline continuations).
 */
export function Button({
  variant = "primary",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button type="button" className={buttonClass(variant, props.className)} {...props}>
      {children}
    </button>
  );
}

/**
 * Navigation action in button clothing. For route changes —
 * never for actions that mutate state.
 */
export function ButtonLink({
  variant = "primary",
  href,
  children,
  className,
}: {
  variant?: ButtonVariant;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
