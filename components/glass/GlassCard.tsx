"use client";
// GlassCard — thin wrapper that renders a `<div class="glass-vNN"
// data-glass-id="...">`. The variant class is the current pick from
// GlassPicksContext (Ellis's DB-persisted choices) or the defaultVariant
// prop (v00 = today's agent-app look) when no pick exists.
//
// Non-Ellis users always have empty picks, so their tagged cards render
// as their defaultVariant every time — identical to today.
//
// Elevra's cards-on-cards nesting (see app/styles/glass.css) works
// automatically because every GlassCard puts `data-glass-id` on its
// root div — the descendant selector handles the blur/shadow strip.
// 2026-08-08.

import React from "react";
import { usePickForCard } from "@/lib/glass/context";
import { classFor, DEFAULT_VARIANT, type GlassVariantId } from "@/lib/glass/variants";

type Props = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Stable unique identifier — used as the pick key and shown in the
   *  Design Lab drawer. Keep it kebab-case, human-readable. */
  glassId: string;
  /** Display name in the drawer, e.g. "Property hero", "Contacts card". */
  label: string;
  /** Variant used when no pick exists. Defaults to v00 (agent current). */
  defaultVariant?: GlassVariantId;
  children?: React.ReactNode;
};

export function GlassCard({
  glassId,
  label,
  defaultVariant = DEFAULT_VARIANT,
  className,
  children,
  ...rest
}: Props) {
  const pick = usePickForCard(glassId);
  const active: GlassVariantId = pick ?? defaultVariant;
  const combined = className
    ? `${classFor(active)} ${className}`
    : classFor(active);
  return (
    <div
      className={combined}
      data-glass-id={glassId}
      data-glass-label={label}
      data-glass-variant={active}
      {...rest}
    >
      {children}
    </div>
  );
}
