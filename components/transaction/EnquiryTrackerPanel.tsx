"use client";

// Internal enquiries tracker panel (Stage 1.6b). Shows whose court the ball is
// in, the chase status, the movement history and the outstanding note, and
// drives the movement/outstanding/snooze actions. Only rendered when the
// enquiries loop is open (the page passes null otherwise).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  logEnquiryMovementAction,
  setEnquiryOutstandingAction,
  setEnquirySnoozeAction,
} from "@/app/actions/enquiries";

type Court = "seller_solicitor" | "buyer_solicitor";
type Status = "closed" | "snoozed" | "stalled" | "chasing";

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
  const [handTo, setHandTo] = useState<"" | Court>("");
  const [outstanding, setOutstanding] = useState(data.outstandingNote ?? "");

  const closed = data.status === "closed";

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  function submitMovement() {
    const text = note.trim();
    if (!text) return;
    run(async () => {
      await logEnquiryMovementAction({
        transactionId,
        note: text,
        flipsCourtTo: handTo || null,
      });
      setNote("");
      setHandTo("");
    });
  }

  // Status banner
  const banner =
    data.status === "closed"
      ? { tone: "done", text: "Enquiries satisfied. The loop is closed." }
      : data.status === "snoozed"
        ? { tone: "muted", text: `Snoozed until ${fmtDate(data.snoozedUntil)}. No nudges until then.` }
        : data.status === "stalled"
          ? { tone: "warn", text: "Stalled. No movement in 3 weeks. Time to call them." }
          : {
              tone: "ok",
              text: `Chasing ${courtLabel(data.currentlyWith)}${data.nextChaseAt ? `. Next nudge ${fmtDate(data.nextChaseAt)}.` : "."}`,
            };
  const bannerBg =
    banner.tone === "warn"
      ? "bg-amber-500/15 text-amber-900 border-amber-500/30"
      : banner.tone === "done"
        ? "bg-emerald-500/15 text-emerald-900 border-emerald-500/30"
        : banner.tone === "muted"
          ? "bg-slate-900/5 text-slate-900/60 border-slate-900/10"
          : "bg-[#FF6B4A]/10 text-slate-900/80 border-[#FF6B4A]/25";

  return (
    <div className="glass-card p-5" style={{ clipPath: "inset(0 round 20px)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900/80">Enquiries</h3>
        <span className="text-xs text-slate-900/40">
          Ball with {courtLabel(data.currentlyWith)}
        </span>
      </div>

      <div className={`text-[13px] rounded-xl border px-3.5 py-2.5 mb-4 ${bannerBg}`}>{banner.text}</div>

      {!closed && (
        <>
          {/* Log a movement */}
          <label className="block text-xs font-medium text-slate-900/50 mb-1.5">Log an update</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Solicitor replied, sent replies across"
            rows={2}
            className="w-full text-[13px] rounded-xl border border-slate-900/10 bg-white/50 px-3 py-2 outline-none focus:border-[#FF6B4A]/50 resize-none"
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-slate-900/40">Now with:</span>
            {([
              ["", "no change"],
              ["seller_solicitor", "seller's sol"],
              ["buyer_solicitor", "buyer's sol"],
            ] as const).map(([val, lbl]) => (
              <button
                key={lbl}
                type="button"
                onClick={() => setHandTo(val)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  handTo === val
                    ? "bg-slate-900/80 text-white border-slate-900/80"
                    : "border-slate-900/15 text-slate-900/60 hover:bg-slate-900/5"
                }`}
              >
                {lbl}
              </button>
            ))}
            <button
              type="button"
              disabled={pending || !note.trim()}
              onClick={submitMovement}
              className="ml-auto text-xs font-semibold text-white bg-[#FF6B4A] hover:bg-[#f2593a] disabled:opacity-40 rounded-full px-3.5 py-1.5"
            >
              {pending ? "Saving…" : "Log update"}
            </button>
          </div>

          {/* Outstanding note */}
          <label className="block text-xs font-medium text-slate-900/50 mt-4 mb-1.5">What&rsquo;s outstanding (optional)</label>
          <div className="flex items-center gap-2">
            <input
              value={outstanding}
              onChange={(e) => setOutstanding(e.target.value)}
              placeholder="e.g. waiting on the management pack"
              className="flex-1 text-[13px] rounded-xl border border-slate-900/10 bg-white/50 px-3 py-2 outline-none focus:border-[#FF6B4A]/50"
            />
            <button
              type="button"
              disabled={pending || outstanding === (data.outstandingNote ?? "")}
              onClick={() => run(() => setEnquiryOutstandingAction({ transactionId, note: outstanding }))}
              className="text-xs font-semibold rounded-full px-3 py-2 border border-slate-900/15 text-slate-900/70 enabled:hover:bg-slate-900/5 disabled:opacity-40"
            >
              Save
            </button>
          </div>

          {/* Snooze */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-slate-900/40">Chase:</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setEnquirySnoozeAction({ transactionId, workingDays: 5 }))}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-900/15 text-slate-900/60 hover:bg-slate-900/5 disabled:opacity-40"
            >
              Snooze 5 working days
            </button>
            {data.status === "snoozed" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setEnquirySnoozeAction({ transactionId, workingDays: null }))}
                className="text-xs px-2.5 py-1 rounded-full border border-slate-900/15 text-slate-900/60 hover:bg-slate-900/5 disabled:opacity-40"
              >
                Resume now
              </button>
            )}
          </div>
        </>
      )}

      {/* Movement history */}
      <div className="mt-5 pt-4 border-t border-slate-900/10">
        <p className="text-xs font-medium text-slate-900/40 mb-2">History</p>
        {data.movements.length === 0 ? (
          <p className="text-[13px] text-slate-900/40 italic">No updates logged yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.movements.map((m) => (
              <li key={m.id} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-slate-900/25 shrink-0" />
                <div className="min-w-0">
                  <span className="text-slate-900/80">{m.note}</span>
                  <span className="text-slate-900/35">
                    {" "}
                    · {fmtDate(m.occurredAt)}
                    {m.flipsCourtTo ? ` · handed to ${m.flipsCourtTo === "seller_solicitor" ? "seller's sol" : "buyer's sol"}` : ""}
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
