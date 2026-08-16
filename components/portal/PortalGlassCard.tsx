"use client";

// PortalGlassCard — tags a portal surface for the Design Lab and applies the
// founder's chosen glass variant. With NO pick it renders the card's normal
// portal surface (white fill + soft shadow), so the portal looks exactly as it
// does today. With a pick, the .glass-vNN class supplies bg/shadow/border, so we
// drop the inline surface (inline styles would otherwise beat the class).
// Always emits data-glass-* so the lab drawer can discover it.

import { usePortalPick } from "@/lib/glass/portal-context";
import { classFor, type GlassVariantId } from "@/lib/glass/variants";
import { P } from "./portal-ui";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  glassId: string;
  label: string;
  /** Portal corner radius kept regardless of variant (default 16). */
  radius?: number;
  /** Baked-in variant when there's no lab pick (a chosen default). The lab
   *  still overrides it. Omit to render the plain portal card surface. */
  defaultVariant?: GlassVariantId;
};

export function PortalGlassCard({ glassId, label, radius = 16, defaultVariant, className, style, children, ...rest }: Props) {
  const pick = usePortalPick(glassId);
  const active = pick ?? defaultVariant;
  const cls = [active ? classFor(active) : "", className].filter(Boolean).join(" ") || undefined;
  const surface: React.CSSProperties = active ? {} : { background: P.cardBg, boxShadow: P.shadowSm };
  return (
    <div
      className={cls}
      data-glass-id={glassId}
      data-glass-label={label}
      data-glass-variant={active ?? "v00"}
      style={{ borderRadius: radius, ...surface, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
