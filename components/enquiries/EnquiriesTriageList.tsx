"use client";

// Enquiries triage list — blitz-confirm whose court each open loop is in without
// opening each file. "Still with them" logs a touch (resets the clock); "Move
// to …" flips the court. Both reuse logEnquiryMovementAction (the same action
// the property-file panel uses). Everything else (snooze, notes, mark
// satisfied) lives on the file, reached via "Open file". Internal only for now.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ArrowsLeftRight, ArrowRight, ChatCircleDots } from "@phosphor-icons/react";
import { logEnquiryMovementAction } from "@/app/actions/enquiries";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { OpenEnquiryRow } from "@/lib/services/enquiries";
import type { EnquiryCourt, EnquiryTrackerStatus } from "@/lib/enquiries/tracker";

const FALLBACK = "/property-photo-fallback.png";
const courtLabel = (c: EnquiryCourt) => (c === "seller_solicitor" ? "seller's solicitor" : "buyer's solicitor");
const courtShort = (c: EnquiryCourt) => (c === "seller_solicitor" ? "seller's side" : "buyer's side");
const otherCourt = (c: EnquiryCourt): EnquiryCourt => (c === "seller_solicitor" ? "buyer_solicitor" : "seller_solicitor");

const STATUS: Record<EnquiryTrackerStatus, { label: string; color: string; bg: string }> = {
  chasing: { label: "Chasing", color: "var(--agent-text-secondary)", bg: "var(--agent-surface-overlay)" },
  snoozed: { label: "Snoozed", color: "var(--agent-text-muted)", bg: "var(--agent-surface-overlay)" },
  stalled: { label: "Stalled", color: "var(--agent-coral-deep)", bg: "rgba(var(--agent-coral-rgb), 0.12)" },
  closed: { label: "Closed", color: "var(--agent-text-muted)", bg: "var(--agent-surface-overlay)" },
};

export function EnquiriesTriageList({
  rows,
  signedPhotos,
}: {
  rows: OpenEnquiryRow[];
  signedPhotos: Record<string, string>;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="agent-glass" style={{ padding: "32px 24px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
        <ChatCircleDots size={28} weight="regular" style={{ color: "var(--agent-text-muted)", marginBottom: 8 }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Every enquiry loop is confirmed.</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>Open loops appear here to blitz through as they need a court check.</p>
      </div>
    );
  }

  function run(id: string, fn: () => Promise<{ ok: boolean }>, successMsg: string) {
    if (busyId) return;
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res?.ok) { toast.success(successMsg); router.refresh(); }
        else toast.error("That didn't save. Please try again.");
      } catch {
        toast.error("That didn't save. Please try again.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="enq-list">
      {rows.map((r) => {
        const photo = r.photoStoragePath ? (signedPhotos[r.photoStoragePath] ?? FALLBACK) : FALLBACK;
        const other = otherCourt(r.currentlyWith);
        const busy = busyId === r.transactionId;
        const s = STATUS[r.status];
        return (
          <div key={r.transactionId} className="enq-row" data-busy={busy ? "" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="enq-thumb" src={photo} alt="" aria-hidden />
            <div className="enq-main">
              <div className="enq-addr-row">
                <Link href={`/agent/transactions/${r.transactionId}`} className="enq-addr" data-sensitive="true">
                  {r.address.split(",")[0].trim()}
                </Link>
                <span className="enq-status" style={{ color: s.color, background: s.bg }}>{s.label}</span>
              </div>
              <div className="enq-meta">
                Ball with the <strong>{courtLabel(r.currentlyWith)}</strong>
                {" · "}quiet {r.quietDays === 0 ? "today" : `${r.quietDays}d`}
                {r.chaseCount > 0 ? ` · chased ${r.chaseCount}×` : ""}
              </div>
              {r.outstandingNote && <div className="enq-note">{r.outstandingNote}</div>}
            </div>
            <div className="enq-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => run(r.transactionId, () => logEnquiryMovementAction({ transactionId: r.transactionId, mode: "touch" }), "Confirmed, still with them")}
                className="enq-btn enq-btn-confirm"
              >
                <Check size={14} weight="bold" /> Still with them
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => run(r.transactionId, () => logEnquiryMovementAction({ transactionId: r.transactionId, mode: "handover", flipsCourtTo: other }), `Moved to the ${courtShort(other)}`)}
                className="enq-btn enq-btn-flip"
              >
                <ArrowsLeftRight size={14} /> Move to {courtShort(other)}
              </button>
              <Link href={`/agent/transactions/${r.transactionId}`} className="enq-open">
                Open file <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
