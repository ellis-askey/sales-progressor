"use client";

// Internal enquiries tracker panel (Stage 1.6b). Shows which solicitor it's
// currently with, the chase status, the movement history and the outstanding
// note, and drives the movement/outstanding/snooze actions. Only rendered while
// enquiries are open (the page passes null otherwise).
//
// The movement controls carry three plain-language intents (2026-08-18):
//   - handover: a reply is in, it moves to the other side (resets the timer)
//   - touch: they've been in touch but it stays with them (resets the timer)
//   - relabel: correct which side it's with without disturbing the chase timer
// The hero slider is the one-tap handover; this panel is the full desk.

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  logEnquiryMovementAction,
  setEnquiryOutstandingAction,
  setEnquirySnoozeAction,
} from "@/app/actions/enquiries";

type Court = "seller_solicitor" | "buyer_solicitor";
type Status = "closed" | "snoozed" | "stalled" | "chasing";
type Mode = "handover" | "touch" | "relabel";

export type EnquiryTrackerPanelData = {
  currentlyWith: Court;
  outstandingNote: string | null;
  status: Status;
  nextChaseAt: Date | null;
  snoozedUntil: Date | null;
  escalated: boolean;
  chaseCount: number;
  movements: { id: string; note: string; occurredAt: Date; source: string; flipsCourtTo: Court | null }[];
};

const courtLabel = (c: Court) => (c === "seller_solicitor" ? "the seller's solicitor" : "the buyer's solicitor");
const fmtDate = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";

export function EnquiryTrackerPanel({
  transactionId,
  data,
}: {
  transactionId: string;
  data: EnquiryTrackerPanelData;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [note, setNote] = useState("");
  const [outstanding, setOutstanding] = useState(data.outstandingNote ?? "");

  const closed = data.status === "closed";
  const other: Court = data.currentlyWith === "seller_solicitor" ? "buyer_solicitor" : "seller_solicitor";

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  function move(mode: Mode, flip: Court | null) {
    const text = note.trim();
    run(async () => {
      await logEnquiryMovementAction({
        transactionId,
        note: text || undefined,
        mode,
        flipsCourtTo: flip,
      });
      setNote("");
    });
  }

  // Option B — status-first. Lead with a plain-English headline of where the
  // enquiries stand; keep EVERY action on the card (handover / touch / relabel
  // / outstanding note / pause / resume) — nothing hidden in a menu. Colours
  // moved onto the --agent-* tokens so it reads in the dark file view too.
  const headline = closed ? "Enquiries satisfied" : `With ${courtLabel(data.currentlyWith)}`;
  const headlineColor =
    data.status === "stalled" ? "var(--agent-warning)" : closed ? "var(--agent-success)" : "var(--agent-text-primary)";
  const sub = closed
    ? "Nothing left to chase."
    : data.status === "snoozed"
      ? `Chasing paused until ${fmtDate(data.snoozedUntil)}`
      : data.status === "stalled"
        ? "No reply in three weeks. Worth a direct call."
        : `Chasing${data.chaseCount > 0 ? ` · chased ${data.chaseCount}×` : ""}${data.nextChaseAt ? ` · next chase ${fmtDate(data.nextChaseAt)}` : ""}`;
  const STATUS_CHIP: Record<Status, { label: string; color: string }> = {
    chasing: { label: "Chasing", color: "var(--agent-coral)" },
    stalled: { label: "Stalled", color: "var(--agent-warning)" },
    snoozed: { label: "Paused", color: "var(--agent-text-muted)" },
    closed:  { label: "Done", color: "var(--agent-success)" },
  };
  const chip = STATUS_CHIP[data.status];

  const secBtn: CSSProperties = {
    fontSize: 11.5, fontWeight: 600, borderRadius: 8, padding: "6px 11px",
    border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)",
    color: "var(--agent-text-secondary)", cursor: "pointer", whiteSpace: "nowrap",
  };

  return (
    <div className="glass-card p-5" style={{ clipPath: "inset(0 round 20px)" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Enquiries</h3>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, color: chip.color, background: "rgba(148,163,184,0.14)" }}>{chip.label}</span>
      </div>

      {/* Status headline */}
      <div style={{ fontSize: 16, fontWeight: 750, letterSpacing: "-0.01em", color: headlineColor, lineHeight: 1.25 }}>{headline}</div>
      <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)" }}>{sub}</p>

      {data.status === "stalled" && (
        <div style={{ marginTop: 11, padding: "8px 11px", borderRadius: 9, fontSize: 11.5, color: "var(--agent-warning)", background: "rgba(245,165,36,0.1)", border: "0.5px solid rgba(245,165,36,0.3)" }}>
          {data.chaseCount > 0 ? `Chased ${data.chaseCount}×, no movement.` : "No movement."} A direct call may shift it.
        </div>
      )}

      {!closed && (
        <>
          {/* Shared, optional note: applies to whichever movement you log */}
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", margin: "14px 0 6px" }}>Add a note (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Solicitor replied, replies sent across"
            rows={2}
            className="w-full resize-none"
            style={{ fontSize: 12.5, borderRadius: 10, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)", padding: "8px 10px", outline: "none" }}
          />

          {/* Actions — every control kept, all visible */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12, alignItems: "center" }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => move("handover", other)}
              title={`Marks it as now with ${courtLabel(other)} and restarts the chase timer`}
              style={{ fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "7px 13px", border: "none", background: "var(--agent-coral)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap", opacity: pending ? 0.5 : 1 }}
            >
              {pending ? "Saving…" : `Replies in → ${courtLabel(other).replace("the ", "")}`}
            </button>
            <button type="button" disabled={pending} onClick={() => move("touch", null)} title="Restarts the chase timer but keeps it on the same side" style={secBtn}>
              Still with them
            </button>
            <button type="button" disabled={pending} onClick={() => move("relabel", other)} title={`Corrects who it's with without resetting the chase timer — switch to ${courtLabel(other)}`} style={secBtn}>
              Wrong side?
            </button>
            {data.status === "snoozed" ? (
              <button type="button" disabled={pending} onClick={() => run(() => setEnquirySnoozeAction({ transactionId, workingDays: null }))} style={secBtn}>Resume now</button>
            ) : (
              <button type="button" disabled={pending} onClick={() => run(() => setEnquirySnoozeAction({ transactionId, workingDays: 5 }))} title="Pause chasing for 5 working days" style={secBtn}>⏸ Pause chasing</button>
            )}
          </div>

          {/* Outstanding note */}
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", margin: "16px 0 6px" }}>What&rsquo;s outstanding (optional)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
              placeholder="e.g. waiting on the management pack"
              className="flex-1"
              style={{ fontSize: 12.5, borderRadius: 10, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)", padding: "8px 10px", outline: "none" }}
            />
            <button
              type="button"
              disabled={pending || outstanding === (data.outstandingNote ?? "")}
              onClick={() => run(() => setEnquiryOutstandingAction({ transactionId, note: outstanding }))}
              style={{ ...secBtn, opacity: (pending || outstanding === (data.outstandingNote ?? "")) ? 0.4 : 1 }}
            >
              Save
            </button>
          </div>
        </>
      )}

      {/* Movement history */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "0.5px solid var(--agent-border-default)" }}>
        <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--agent-text-muted)", margin: "0 0 9px" }}>History</p>
        {data.movements.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>No updates logged yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {data.movements.map((m) => (
              <li key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12.5 }}>
                <span style={{ marginTop: 5, width: 6, height: 6, borderRadius: 999, background: "var(--agent-text-muted)", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: "var(--agent-text-primary)" }}>{m.note}</span>
                  <span style={{ color: "var(--agent-text-muted)" }}>
                    {" "}· {fmtDate(m.occurredAt)}{m.flipsCourtTo ? ` · now with ${courtLabel(m.flipsCourtTo)}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
