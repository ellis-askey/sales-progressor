"use client";

// Hub card: enquiry loops that have gone quiet past the escalation threshold
// (13 working days of silence). The safety net for the enquiries stage — it
// surfaces stalled loops whether or not auto-chasing is on for the agency, so a
// file can never sit silent for weeks unseen. Each row's "Chase" button opens the
// shared ChaseDrawer in enquiry mode — a real send to the court's solicitor —
// right here on the hub; a sent loop drops off the list immediately. Empty list →
// renders nothing.

import { useState } from "react";
import Link from "next/link";
import { ChatCircleDots, PaperPlaneTilt } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { HubCard } from "@/components/hub/HubCard";
import { HubRow } from "@/components/hub/HubRow";
import { buttonClasses } from "@/components/arc/button/button";
import { ChaseDrawer } from "@/components/chase/ChaseDrawer";
import type { StalledEnquiryItem } from "@/lib/services/hub";

const INITIAL_VISIBLE = 6;
const ICON_COLOR = "var(--agent-coral-deep)";
const ACCENT = "var(--agent-coral)";
const courtLabel = (c: string) => (c === "seller_solicitor" ? "the seller's solicitor" : "the buyer's solicitor");

// First line + town/postcode (last two comma parts). Inline per the grandfathered
// per-component pattern shared across the hub cards.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

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
    <HubCard
      glassId="hub-attention"
      label="Hub · Enquiries gone quiet"
      icon={<ChatCircleDots size={24} weight="regular" />}
      iconColor={ICON_COLOR}
      title={<><span style={{ color: "var(--agent-coral-deep)", fontWeight: 700 }}>{visible.length}</span> {visible.length === 1 ? "enquiry needs" : "enquiries need"} a nudge</>}
      subtitle="Ones to chase again, or that have gone quiet."
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
    >
          {shown.map((row, i) => {
            const href = `/agent/transactions/${row.transactionId}`;
            const photoUrl = row.photoStoragePath ? signedPhotos[row.photoStoragePath] ?? null : null;
            // Named firm leads when we have it ("With Juno Property Lawyers Ltd");
            // the side label is the fallback (critique 2026-10-15).
            const withPrefix = row.solicitorName ? `With ${row.solicitorName}` : `With ${courtLabel(row.currentlyWith)}`;
            const isStalled = row.kind === "stalled";
            // Row label + tone: red "Gone quiet" (gone dark, nobody chasing) vs
            // orange "Chase again" (your move after the leash) — critique #289.
            const label = isStalled ? "Gone quiet" : "Chase again";
            const labelColor = isStalled ? "var(--agent-danger)" : "var(--agent-coral-deep)";
            const rowAccent = isStalled ? "var(--agent-danger)" : ACCENT;
            // "With {solicitor} for N days" — no dot, no "Quiet"; the row label
            // carries the status, so the line just says how long it's been with
            // them (reads cleaner).
            const forPart = `for ${row.quietDays} ${row.quietDays === 1 ? "day" : "days"}`;
            const withText = `${withPrefix} ${forPart}`;
            const addr = splitAddress(row.address);
            return (
              <HubRow
                key={row.transactionId}
                accent={rowAccent}
                separated={i > 0}
                thumb={
                  <Link href={href} className="hub-thumb-link" aria-label={`Open ${row.address}`}>
                    <PropertyThumb photoUrl={photoUrl} />
                  </Link>
                }
                tail={
                  <>
                    {/* Phone: the context stacks (no dot) left of the Chase
                        button — "With …" line, then "Quiet N days". */}
                    <span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }} data-sensitive="true">
                      <span>{withPrefix}</span>
                      <span>{forPart}</span>
                    </span>
                    <button type="button" onClick={() => { setChase(row); setChaseOpen(true); }} className={buttonClasses({ variant: "outline", size: "sm", className: "hub-r-actions" })} style={{ gap: 5, flexShrink: 0 }}>
                      <PaperPlaneTilt size={13} weight="bold" /> Chase
                    </button>
                  </>
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Link href={href} className="hub-addr" data-sensitive="true" style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}>
                    <span className="hub-addr-full">{row.address}</span>
                    <span className="hub-addr-line">{addr.line}</span>
                    {addr.location && <span className="hub-addr-loc">{addr.location}</span>}
                  </Link>
                </div>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: labelColor, marginTop: 2, lineHeight: 1.3 }}>{label}</span>
                <p className="hub-r-meta-d" style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-sensitive="true">
                  {withText}
                </p>
              </HubRow>
            );
          })}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAll(true)} className="agent-link" style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}>
              Show all ({visible.length})
            </button>
          )}
    </HubCard>
    {chaseOpen && chase && (() => {
      // Feed the SAME drawer the reminder enquiry chase uses (ChaseDrawer) in
      // enquiry mode: the court solicitor as the fixed recipient + the side's
      // clients as CC, built from the hub's loop data. `enquiry` swaps only the
      // Generate/Send logic (enquiry-aware); the UI is the shared one.
      const side: "vendor" | "purchaser" = chase.currentlyWith === "buyer_solicitor" ? "purchaser" : "vendor";
      const contacts = [
        { id: "enq-solicitor", name: chase.solicitorName ?? "The solicitor", roleType: "solicitor", email: chase.solicitorEmail ?? null, side, firmName: chase.solicitorName },
        ...chase.ccCandidates.map((c) => ({ id: c.contactId, name: c.name, roleType: side, email: c.email })),
      ];
      return (
        <ChaseDrawer
          chaseTaskId=""
          transactionId={chase.transactionId}
          propertyAddress={chase.address}
          propertyPhotoUrl={chase.photoStoragePath ? signedPhotos[chase.photoStoragePath] ?? null : null}
          milestoneName="Enquiries"
          chaseCount={chase.chaseCount}
          contacts={contacts}
          preferRole="solicitor"
          defaultAddRole={side}
          enquiry
          onClose={() => setChaseOpen(false)}
          onSent={() => { setSentIds((s) => new Set(s).add(chase.transactionId)); }}
        />
      );
    })()}
    </>
  );
}
