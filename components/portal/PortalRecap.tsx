"use client";

// PortalRecap — "Since you were last here" (Portal Engagement v2, Phase 1).
// Sits in the PortalOverviewHero `beforeProgress` slot: directly below the
// photo hero, above the Progress-overview card. Shows up to two things that
// changed since the client's previous visit, so a returning buyer/seller
// immediately understands WHY they're back. Renders nothing when there's
// nothing new (the page passes no items), keeping the portal calm.
//
// "Needed from you" deliberately lives on the existing PortalNextActionCard,
// not here, so the same action never appears twice on one screen.
//
// Each row (and the footer) links to the Updates tab and records a
// portal_recap_item_clicked event via a server action, so we can measure
// whether the recap actually drives engagement.

import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import { PortalGlassCard } from "./PortalGlassCard";
import { portalTrackRecapClickAction } from "@/app/actions/portal";

export type RecapItem = { id: string; title: string };

export function PortalRecap({
  token,
  whenLabel,
  items,
  extraCount,
}: {
  token: string;
  whenLabel: string;
  items: RecapItem[];
  /** newCount beyond the (max 2) items shown — drives the "N more" hint. */
  extraCount: number;
}) {
  if (items.length === 0) return null;
  const updatesHref = `/portal/${token}/updates`;
  const track = () => {
    void portalTrackRecapClickAction(token);
  };

  return (
    <PortalGlassCard glassId="recap" label="Since you were last here" className="portal-reveal-up overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${P.border}` }}>
        <p className="text-[11px] font-bold uppercase" style={{ color: P.primary, letterSpacing: "0.06em" }}>
          Since you were last here
        </p>
        <span className="text-[12px]" style={{ color: P.textMuted }}>{whenLabel}</span>
      </div>

      {items.map((it, i) => (
        <Link
          key={it.id}
          href={updatesHref}
          onClick={track}
          className="px-5 py-4 flex items-start gap-3"
          style={{
            borderBottom: i < items.length - 1 ? `1px solid ${P.border}` : undefined,
            textDecoration: "none",
          }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
            style={{ background: P.primary }}
            aria-label="New"
            title="New"
          />
          <p className="flex-1 min-w-0 text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>
            {it.title}
          </p>
          <CaretRight size={16} weight="bold" style={{ color: P.textMuted, flexShrink: 0, marginTop: 2 }} aria-hidden />
        </Link>
      ))}

      <Link
        href={updatesHref}
        onClick={track}
        className="block text-center px-5 py-3 text-[13px] font-semibold"
        style={{ color: P.accent, textDecoration: "none", borderTop: `1px solid ${P.border}` }}
      >
        {extraCount > 0 ? `View all updates (${extraCount} more)` : "View all updates"}
      </Link>
    </PortalGlassCard>
  );
}
