"use client";

import { useState, useTransition } from "react";
import { PortalSheet } from "./PortalSheet";
import { P } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { PortalGlassCard } from "./PortalGlassCard";
import { DateField } from "@/components/ui/DateField";
import { usePortalReadOnly } from "./PortalReadOnlyProvider";
import { portalConfirmCheckpointAction } from "@/app/actions/portal";

// One item as the client sees it — their side only.
export type PortalCheckpoint = {
  id: string;
  label: string;
  targetDate: string | null;
  mineDone: boolean;    // this side has confirmed their part
  mineDate: string | null;
  isComplete: boolean;  // all required parties confirmed
  isBoth: boolean;      // needs both sides
};

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["#FF8A65", "#FFB74D", "#FFD54F", "#FF6B4A", "#FFA726"] });
  setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors: ["#FF8A65", "#FFB74D", "#FFD54F"] }), 260);
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PortalThingsToConfirm({
  token, otherName, items, frameLabel = "Things to confirm",
}: {
  token: string;
  otherName: string;
  items: PortalCheckpoint[];
  frameLabel?: string;
}) {
  const readOnly = usePortalReadOnly();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading] = useState(false);

  if (!items.length) return null;

  const open = items.filter((i) => !i.mineDone);
  const waiting = items.filter((i) => i.mineDone && !i.isComplete);
  const done = items.filter((i) => i.isComplete);
  const pending = items.find((i) => i.id === pendingId) ?? null;

  function openSheet(id: string) {
    setPendingId(id);
    setEventDate(todayISO());
  }
  function closeSheet() {
    if (loading) return;
    setPendingId(null);
  }
  function confirm() {
    if (!pending) return;
    if (readOnly) { setPendingId(null); return; }
    const id = pending.id;
    const ed = eventDate || null;
    setPendingId(null);
    setLoading(true);
    startTransition(async () => {
      try {
        const r = await portalConfirmCheckpointAction({ token, checkpointId: id, eventDate: ed });
        if (r.ok) await fireConfetti();
      } finally {
        setLoading(false);
      }
    });
  }

  return (
    <>
      <PortalGlassCard glassId="things-to-confirm" label="Things to confirm" defaultVariant="v05" className="overflow-hidden">
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: P.primary }}>{frameLabel}</p>
        </div>

        {open.map((cp) => (
          <div key={cp.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${P.border}` }}>
            <span className="flex-none mt-0.5 w-6 h-6 rounded-full" style={{ background: "#fff", border: `2px solid ${P.primary}`, display: "grid", placeItems: "center" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.primary }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>{cp.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: cp.targetDate ? P.primaryText : P.textMuted }}>
                {cp.targetDate ? `Needed by ${fmt(cp.targetDate)}` : "Action needed from you"}
              </p>
            </div>
            <button
              onClick={() => openSheet(cp.id)}
              className="pbtn pbtn-primary pbtn-press flex-none"
              style={{ padding: "8px 15px", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", boxShadow: "0 1px 0 #C63E20, 0 3px 8px rgba(240,78,44,0.28)" }}
            >
              Confirm
            </button>
          </div>
        ))}

        {waiting.map((cp) => (
          <div key={cp.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${P.border}` }}>
            <span className="flex-none mt-0.5 w-6 h-6 rounded-full" style={{ background: "#fff", border: `2px solid ${P.accent}`, display: "grid", placeItems: "center" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: P.accent }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium leading-snug" style={{ color: P.textPrimary }}>{cp.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "#0060DF" }}>You confirmed{cp.mineDate ? ` on ${fmt(cp.mineDate)}` : ""} · waiting on {otherName}</p>
            </div>
          </div>
        ))}

        {done.map((cp) => (
          <div key={cp.id} className="flex items-start gap-3 px-5 py-3.5" style={{ borderTop: `1px solid ${P.border}` }}>
            <span className="flex-none mt-0.5 w-6 h-6 rounded-full" style={{ background: P.success, display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium leading-snug line-through" style={{ color: P.textMuted }}>{cp.label}</p>
              <p className="text-[12px] mt-0.5" style={{ color: P.success }}>Confirmed{cp.mineDate ? ` · ${fmt(cp.mineDate)}` : ""}</p>
            </div>
          </div>
        ))}
      </PortalGlassCard>

      <PortalSheet open={pending != null} onClose={closeSheet} closeDisabled={loading}>
        <div className="px-6 pb-6 pt-2">
          <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>Are you sure?</p>
          {pending && (
            <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
              You&apos;re confirming: {pending.label}.{pending.isBoth ? ` ${otherName} confirms their side too.` : ""}
            </p>
          )}
          <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>Date this was done</label>
          <DateField
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
            style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
          />
          <div className="mt-4">
            <PortalButton onClick={confirm}>Yes, confirm</PortalButton>
          </div>
          <button onClick={closeSheet} className="pbtn pbtn-press w-full mt-3 py-3 text-[15px] font-medium rounded-xl" style={{ color: P.textSecondary, background: "transparent" }}>
            Cancel
          </button>
        </div>
      </PortalSheet>
    </>
  );
}
