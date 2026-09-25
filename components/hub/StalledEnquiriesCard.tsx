"use client";

// Hub card: enquiry loops that have gone quiet past the escalation threshold
// (13 working days of silence). The safety net for the enquiries stage — it
// surfaces stalled loops whether or not auto-chasing is on for the agency, so a
// file can never sit silent for weeks unseen. Each row's "Chase" button opens the
// EnquiryChaseDrawer — a real send to the court's solicitor — right here on the
// hub; a sent loop drops off the list immediately. Empty list → renders nothing.

import { useState } from "react";
import Link from "next/link";
import { ChatCircleDots, CaretDown, PaperPlaneTilt } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { EnquiryChaseDrawer } from "@/components/enquiries/EnquiryChaseDrawer";
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
  // Send-a-chase drawer, opened from a row's Chase button. On a successful send
  // the loop's quiet clock resets server-side (revalidatePath refreshes the hub);
  // we also drop it locally so it disappears the instant it's chased.
  const [chase, setChase] = useState<StalledEnquiryItem | null>(null);
  const [chaseOpen, setChaseOpen] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const visible = rows.filter((r) => !sentIds.has(r.transactionId));
  if (visible.length === 0) return null;

  const shown = showAll ? visible : visible.slice(0, INITIAL_VISIBLE);
  const hiddenCount = visible.length - shown.length;

  return (
    <>
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
            {visible.length === 1 ? "1 loop" : `${visible.length} loops`} silent for 3+ weeks. Worth a direct call or a chase.
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          {shown.map((row, i) => {
            const href = `/agent/transactions/${row.transactionId}`;
            const photoUrl = row.photoStoragePath ? signedPhotos[row.photoStoragePath] ?? null : null;
            const withText = `With ${courtLabel(row.currentlyWith)}${row.solicitorName ? ` (${row.solicitorName})` : ""} · quiet ${row.quietDays} ${row.quietDays === 1 ? "day" : "days"}`;
            return (
              <div key={row.transactionId} style={{ borderLeft: `3px solid ${ACCENT}`, borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}>
                <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
                  <Link href={href} className="hub-thumb-link" aria-label={`Open ${row.address}`}>
                    <PropertyThumb photoUrl={photoUrl} />
                  </Link>
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <Link href={href} className="hub-addr" data-sensitive="true" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.address}
                      </Link>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-sensitive="true">
                      {withText}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setChase(row); setChaseOpen(true); }} className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: "auto", flexShrink: 0 }}>
                    <PaperPlaneTilt size={13} weight="bold" /> Chase
                  </button>
                </div>
              </div>
            );
          })}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="agent-link" style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}>
              Show all ({visible.length})
            </button>
          )}
        </div>
      </div>
    </GlassCard>
    <EnquiryChaseDrawer
      open={chaseOpen}
      transactionId={chase?.transactionId ?? ""}
      address={chase?.address ?? ""}
      court={chase?.currentlyWith ?? "seller_solicitor"}
      solicitorName={chase?.solicitorName ?? null}
      solicitorEmail={chase?.solicitorEmail ?? null}
      ccCandidates={chase?.ccCandidates ?? []}
      chaseCount={chase?.chaseCount ?? 0}
      onClose={() => setChaseOpen(false)}
      onSent={() => { if (chase) setSentIds((s) => new Set(s).add(chase.transactionId)); }}
    />
    </>
  );
}
