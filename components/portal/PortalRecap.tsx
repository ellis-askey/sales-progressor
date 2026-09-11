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
import { ActorAvatar } from "@/components/ui/Avatar";
import type { TimelineActor } from "@/lib/portal/timeline-actor";
import { portalTrackRecapClickAction } from "@/app/actions/portal";

// Per-row leading avatar is the shared branded tsp-avatar (ActorAvatar):
// seller blue / buyer green / progressor|agent orange / solicitor grey, with the
// person's photo when we have it. Identical treatment to the Updates tab and the
// Latest-updates card — see lib/portal/timeline-actor.ts.
export type RecapItem = { id: string; title: string; actor: TimelineActor };

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
          className="portal-chev px-5 py-4 flex items-center gap-3"
          style={{
            borderBottom: i < items.length - 1 ? `1px solid ${P.border}` : undefined,
            textDecoration: "none",
          }}
        >
          <ActorAvatar name={it.actor.name} role={it.actor.role} image={it.actor.image} size={28} className="flex-shrink-0" />
          <p className="flex-1 min-w-0 text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>
            {it.title}
          </p>
          <span className="portal-chev-i" style={{ display: "inline-flex", flexShrink: 0 }}>
            <CaretRight size={16} weight="bold" style={{ color: P.textMuted }} aria-hidden />
          </span>
        </Link>
      ))}

      <Link
        href={updatesHref}
        onClick={track}
        className="portal-recap-viewall block text-center px-5 py-3 text-[13px] font-semibold"
        style={{ color: P.accent, textDecoration: "none", borderTop: `1px solid ${P.border}` }}
      >
        {extraCount > 0 ? `View all updates (${extraCount} more)` : "View all updates"}
      </Link>
    </PortalGlassCard>
  );
}
