"use client";

import { useState } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { confirmMilestoneAction } from "@/app/actions/milestones";

type NextMilestone = {
  id: string;
  name: string;
  code: string;
  eventDateRequired: boolean;
};

export type MilestoneSideState =
  | { state: "hasNext"; milestone: NextMilestone }
  | { state: "gatePending"; gateType: "exchange_gate" | "post_exchange" }
  | { state: "completionPending"; completionDate: Date }
  | { state: "allComplete" };

type Props = {
  transactionId: string;
  vendorSide: MilestoneSideState;
  purchaserSide: MilestoneSideState;
};

function MilestoneSideRow({
  side,
  label,
  transactionId,
}: {
  side: MilestoneSideState;
  label: string;
  transactionId: string;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [flashed, setFlashed] = useState(false);
  // "completed" UI state — runs between the server confirm landing and
  // the row disappearing (parent re-fetch). The button briefly turns
  // green with a ✓ so the user has a clear "yes, done" reward.
  const [justCompleted, setJustCompleted] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [desktopValuation, setDesktopValuation] = useState(false);

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 16px",
    borderBottom: "0.5px solid var(--agent-border-default)",
  };

  if (side.state === "allComplete") {
    return (
      <div className="agent-hover-row" style={rowStyle}>
        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", margin: 0 }}>{label}</p>
          <p className="text-xs text-emerald-600 font-medium" style={{ margin: 0 }}>All steps complete</p>
        </div>
      </div>
    );
  }

  if (side.state === "gatePending") {
    const copy =
      side.gateType === "exchange_gate"
        ? "Awaiting exchange-readiness"
        : "Awaiting exchange confirmation";
    return (
      <div className="agent-hover-row" style={rowStyle}>
        <div className="w-5 h-5 rounded-full bg-amber-50 border-2 border-amber-200 flex-shrink-0" />
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{copy}</p>
        </div>
      </div>
    );
  }

  if (side.state === "completionPending") {
    const formatted = side.completionDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return (
      <div className="agent-hover-row" style={rowStyle}>
        <div className="w-5 h-5 rounded-full bg-blue-50 border-2 border-blue-200 flex-shrink-0" />
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Completion due {formatted}</p>
        </div>
      </div>
    );
  }

  // side.state === "hasNext"
  const { milestone } = side;
  const isPM6 = milestone.code === "PM6";

  async function handleClick() {
    setLoading(true);
    try {
      await confirmMilestoneAction({
        transactionId,
        milestoneDefinitionId: milestone.id,
      });
      toast.success(milestone.name);
      setLoading(false);
      setJustCompleted(true);
      setFlashed(true);
      // Hold the "Completed ✓" state for ~700ms so the user sees the
      // green button before the parent refresh removes the row.
      setTimeout(() => setFlashed(false), 700);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to confirm step";
      toast.error("Couldn't confirm step", { description: message });
      setLoading(false);
    }
  }

  async function handleDateConfirm() {
    setLoading(true);
    try {
      await confirmMilestoneAction({
        transactionId,
        milestoneDefinitionId: milestone.id,
        eventDate: desktopValuation ? null : eventDate || null,
      });
      setShowDatePicker(false);
      setEventDate("");
      setDesktopValuation(false);
      setLoading(false);
      setJustCompleted(true);
      setFlashed(true);
      setTimeout(() => setFlashed(false), 700);
      toast.success(milestone.name);
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to confirm step";
      toast.error("Couldn't confirm step", { description: message });
      setLoading(false);
    }
  }

  return (
    <div
      className={`agent-hover-row${flashed ? " agent-row-flash" : ""}`}
      style={{
        ...rowStyle,
        flexWrap: "wrap",
        // Whole-row fade on success — entire row dissolves before the
        // parent's auto-animate unmounts it (keyed by milestone.id) and
        // slides the next milestone up.
        animation: justCompleted ? "completeRowFade 700ms cubic-bezier(0.16, 1, 0.3, 1) forwards" : undefined,
      }}
    >
      <div className="w-5 h-5 rounded-full bg-blue-50 border-2 border-blue-300 flex-shrink-0" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{milestone.name}</p>
      </div>
      {!showDatePicker && (
        <button
          onClick={milestone.eventDateRequired ? () => setShowDatePicker(true) : handleClick}
          disabled={loading || justCompleted}
          className="agent-btn agent-btn-xs agent-btn-primary"
          style={{
            // Pulse while in flight (theme coral). Brief solid flash on
            // success — the row animation handles the fade-out, button
            // just shows the tick during that window.
            animation: loading
              ? "completeBtnPulse 900ms ease-in-out infinite"
              : justCompleted
                ? "completeBtnFlash 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards"
                : undefined,
            transition: "background 150ms",
            minWidth: 64,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          {justCompleted ? (
            <span aria-hidden style={{ fontSize: 14, lineHeight: 1, fontWeight: 700 }}>✓</span>
          ) : (
            "Complete"
          )}
          <style>{`
            @keyframes completeBtnPulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,74,0.55); }
              50%      { box-shadow: 0 0 0 6px rgba(255,107,74,0); }
            }
            @keyframes completeBtnFlash {
              0%   { transform: scale(1); }
              50%  { transform: scale(1.08); }
              100% { transform: scale(1); }
            }
            @keyframes completeRowFade {
              0%   { opacity: 1; max-height: 200px; }
              40%  { opacity: 1; max-height: 200px; }
              100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; margin: 0; border-bottom-width: 0; }
            }
          `}</style>
        </button>
      )}
      {showDatePicker && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 4, paddingLeft: 32 }}>
          <input
            type="date"
            value={eventDate}
            disabled={isPM6 && desktopValuation}
            onChange={(e) => setEventDate(e.target.value)}
            className="glass-input px-2 py-1.5 text-sm disabled:opacity-40"
          />
          {isPM6 && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--agent-text-primary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={desktopValuation}
                onChange={(e) => {
                  setDesktopValuation(e.target.checked);
                  if (e.target.checked) setEventDate("");
                }}
              />
              Desktop valuation — no date
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleDateConfirm}
              disabled={loading || (!eventDate && !(isPM6 && desktopValuation))}
              className="agent-btn agent-btn-xs agent-btn-primary"
            >
              {loading ? "…" : "Confirm"}
            </button>
            <button
              onClick={() => { setShowDatePicker(false); setEventDate(""); setDesktopValuation(false); }}
              disabled={loading}
              className="agent-btn agent-btn-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NextMilestoneWidget({ transactionId, vendorSide, purchaserSide }: Props) {
  const [rowsRef] = useAutoAnimate<HTMLDivElement>();
  if (vendorSide.state === "allComplete" && purchaserSide.state === "allComplete") return null;

  return (
    <div className="glass-card overflow-hidden rounded-[12px]">
      <div className="agent-card-hdr">
        <h3 className="agent-card-title">Next steps</h3>
      </div>
      <div ref={rowsRef}>
        {/* Key by milestone ID + state-kind so React unmounts/remounts
          * when the next milestone becomes a different row — auto-animate
          * then animates the old row OUT and the new one IN as a single
          * sliding motion, instead of mutating the row's content in-place. */}
        <MilestoneSideRow
          key={`v-${vendorSide.state === "hasNext" ? vendorSide.milestone.id : vendorSide.state}`}
          side={vendorSide}
          label="Vendor"
          transactionId={transactionId}
        />
        <MilestoneSideRow
          key={`p-${purchaserSide.state === "hasNext" ? purchaserSide.milestone.id : purchaserSide.state}`}
          side={purchaserSide}
          label="Purchaser"
          transactionId={transactionId}
        />
      </div>
    </div>
  );
}
