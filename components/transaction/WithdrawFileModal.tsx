"use client";

// The withdraw-file modal, extracted verbatim from StatusControl (Ellis,
// 2026-09-18) so the hub's Files-to-review card can offer the full "move on"
// flow in place. Presentational: it collects the structured WithdrawalReason
// (drives chain-cascade direction — closed-loop arc 2026-06-05) plus the
// optional free-text detail, and hands both to the caller. The caller owns
// the server action, optimistic state and toasts, so StatusControl's
// behaviour is byte-identical to before the extraction.

import { useState } from "react";
import { createPortal } from "react-dom";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import type { WithdrawalReason } from "@prisma/client";

// Structured withdrawal reasons drive chain-cascade direction per the
// closed-loop arc (2026-06-05). Cascade rules (see cascadeChainWithdrawal):
//   BUYER_WITHDREW       → upward cascade, downstream detaches
//   SELLER_WITHDREW      → downward cascade, upstream detaches
//   CHAIN_COLLAPSE_ABOVE → no local cascade (upstream already cascading),
//                          downstream detaches
//   OTHER                → both directions cascade, no detachment
export const WITHDRAWAL_REASONS: Array<{
  value: WithdrawalReason;
  label: string;
  helper: string;
}> = [
  {
    value: "BUYER_WITHDREW",
    label: "Our buyer pulled out",
    helper: "Buyer changed their mind, finance fell through, or the survey raised problems",
  },
  {
    value: "SELLER_WITHDREW",
    label: "Our seller pulled out",
    helper: "Seller decided not to move, or their onward purchase fell through",
  },
  {
    value: "CHAIN_COLLAPSE_ABOVE",
    label: "Chain collapsed above us",
    helper: "Responding to a withdrawal notification from upstream",
  },
  {
    value: "OTHER",
    label: "Other / mutual",
    helper: "Survey, mortgage, gazundering, joint decision, etc.",
  },
];

export function WithdrawFileModal({
  inChain = false,
  onCancel,
  onConfirm,
}: {
  inChain?: boolean;
  onCancel: () => void;
  // finalReason = the agent's free text, or the picked reason's human label
  // when no text was given (so the file history reads naturally).
  onConfirm: (reason: WithdrawalReason, finalReason: string | null) => void;
}) {
  const { theme, isNight } = usePortalTheme();
  const [pickedReason, setPickedReason] = useState<WithdrawalReason | "">("");
  const [detailText, setDetailText] = useState("");

  function confirmWithdrawal() {
    if (!pickedReason) return;
    const labelByValue = Object.fromEntries(WITHDRAWAL_REASONS.map((r) => [r.value, r.label]));
    const finalReason = detailText.trim() || labelByValue[pickedReason] || null;
    onConfirm(pickedReason, finalReason);
  }

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 1500 }}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl w-full max-w-sm"
        // maxHeight + internal scroll (audit E3): the 4 reason cards +
        // detail input exceeded short viewports and pushed the Confirm
        // row off-screen with no way to reach it.
        style={{ overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "calc(100dvh - 48px)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Ribbon coral band */}
        <div style={{ ...SHEET_BAND_STYLE, flexShrink: 0 }}>
          <SheetBandHeader kicker="Withdraw" title="Mark as withdrawn" subtitle="Record why this sale fell through" />
        </div>

        <div className="p-6" style={{ overflowY: "auto", minHeight: 0 }}>
          {/* Question 1 — Who pulled out? Drives chain cascade direction
            * via WithdrawalReason. See closed-loop arc 2026-06-05. */}
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Who pulled out
          </label>
          <div className="space-y-1.5 mb-4">
            {WITHDRAWAL_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setPickedReason(r.value)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  pickedReason === r.value
                    ? "border-red-300 bg-red-50 text-red-700 font-medium"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 agent-hover-row"
                }`}
              >
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: pickedReason === r.value ? "rgba(185,28,28,0.85)" : "rgba(15,23,42,0.5)" }}>
                  {r.helper}
                </div>
              </button>
            ))}
          </div>

          {inChain && pickedReason && (
            <div
              className="agent-reveal-in mb-4 px-3 py-2 rounded-lg text-[11px]"
              style={{ background: "rgba(15,23,42,0.04)", color: "rgba(15,23,42,0.65)", border: "0.5px solid rgba(15,23,42,0.08)" }}
            >
              {pickedReason === "BUYER_WITHDREW" && (
                <>The agent <strong>above</strong> you in the chain will be notified that you&apos;ve lost your buyer. The chain below you will be split off into its own chain.</>
              )}
              {pickedReason === "SELLER_WITHDREW" && (
                <>The agent <strong>below</strong> you in the chain will be notified that they&apos;ve lost their purchase. The chain above you will be split off into its own chain.</>
              )}
              {pickedReason === "CHAIN_COLLAPSE_ABOVE" && (
                <>The agents above you have already been notified. Nothing new is sent from your side. The chain below you will be split off into its own chain.</>
              )}
              {pickedReason === "OTHER" && (
                <>Agents on <strong>both sides</strong> of the chain will be notified. The chain stays connected for now, and they decide their own next step.</>
              )}
            </div>
          )}

          {/* Question 2 — optional free-text detail, captured as
            * PropertyTransaction.fallThroughReason for the archived
            * round drawer. */}
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Detail <span style={{ color: "rgba(15,23,42,0.4)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={detailText}
            onChange={(e) => setDetailText(e.target.value)}
            placeholder="What happened? (mortgage failed, gazumped, survey, etc.)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-400 mb-4"
          />

          {/* CTAs follow the canonical SwitchServiceTypeModal / RelistFileModal
           *  pattern (padding 8/14, font 13, radius 8, no flex-1 stretch).
           *  Confirm keeps a red background on purpose — withdrawal is
           *  destructive — but matches the primary CTA's shape and weight. */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--agent-text-secondary, #4b5563)",
                background: "transparent",
                border: "0.5px solid var(--agent-border-default, rgba(0,0,0,0.12))",
                cursor: "pointer",
              }}
              className="hover:bg-black/[0.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmWithdrawal}
              disabled={!pickedReason}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "var(--agent-danger, #C73E3E)",
                border: "none",
                cursor: !pickedReason ? "default" : "pointer",
                opacity: !pickedReason ? 0.5 : 1,
                minWidth: 150,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Confirm withdrawal
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
