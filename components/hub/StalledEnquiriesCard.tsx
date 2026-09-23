"use client";

// Hub card: enquiry loops that have gone quiet past the escalation threshold
// (13 working days of silence). The safety net for the enquiries stage — it
// surfaces stalled loops whether or not auto-chasing is on for the agency, so a
// file can never sit silent for weeks unseen. Read-only surfacing + a jump to the
// file / the enquiries desk to act; a one-tap "Chase now" slots in here once the
// send-chase drawer lands. Empty list → renders nothing.

import { useState } from "react";
import Link from "next/link";
import { ChatCircleDots, CaretDown, ArrowRight } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import type { StalledEnquiryItem } from "@/lib/services/hub";

const INITIAL_VISIBLE = 6;
const ICON_COLOR = "var(--agent-coral-deep)";
const ACCENT = "var(--agent-coral)";
const courtLabel = (c: string) => (c === "seller_solicitor" ? "the seller's solicitor" : "the buyer's solicitor");

export function StalledEnquiriesCard({ rows, signedPhotos, defaultCollapsed = false }: {
  rows: StalledEnquiryItem[];
  signedPhotos: Record<string, string>;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);

  if (rows.length === 0) return null;

  const shown = showAll ? rows : rows.slice(0, INITIAL_VISIBLE);
  const hiddenCount = rows.length - shown.length;

  return (
    <GlassCard glassId="hub-stalled-enquiries" label="Hub · Enquiries gone quiet" defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: ICON_COLOR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ChatCircleDots size={24} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>Enquiries gone quiet</span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {rows.length === 1 ? "1 loop" : `${rows.length} loops`} silent for 3+ weeks. Worth a direct call or a chase.
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          {shown.map((row, i) => {
            const line1 = row.address.split(",")[0].trim();
            const photoUrl = row.photoStoragePath ? signedPhotos[row.photoStoragePath] ?? null : null;
            const withText = `With ${courtLabel(row.currentlyWith)}${row.solicitorName ? ` (${row.solicitorName})` : ""} · quiet ${row.quietDays} ${row.quietDays === 1 ? "day" : "days"}`;
            return (
              <div key={row.transactionId} style={{ borderLeft: `3px solid ${ACCENT}`, borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
                <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
                  <PropertyThumb photoUrl={photoUrl} />
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Link href={`/agent/transactions/${row.transactionId}`} className="hover:underline" data-sensitive="true" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {line1}
                      </Link>
                      <Pill glass tone="danger" size="md" style={{ flexShrink: 0 }}>Stalled</Pill>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-sensitive="true">
                      {withText}
                    </p>
                  </div>
                  <Link href="/agent/enquiries" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto", flexShrink: 0, textDecoration: "none" }}>
                    Chase <ArrowRight size={13} weight="bold" />
                  </Link>
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="agent-link" style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}>
              Show all ({rows.length})
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
