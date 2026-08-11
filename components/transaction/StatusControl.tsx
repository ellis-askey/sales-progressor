"use client";
// components/transaction/StatusControl.tsx

import { useState, useEffect, useTransition, useRef } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { changeStatusAction } from "@/app/actions/transactions";
import { pauseClientEmails } from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import type { TransactionStatus, WithdrawalReason } from "@prisma/client";

const STATUSES: { value: TransactionStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

// Structured withdrawal reasons drive chain-cascade direction per the
// closed-loop arc (2026-06-05). Each option carries a human label, a short
// helper for the radio card body, and the WithdrawalReason enum value
// that the changeStatusAction stores on PropertyTransaction.withdrawalReason.
// Cascade rules (see cascadeChainWithdrawal):
//   BUYER_WITHDREW       → upward cascade, downstream detaches
//   SELLER_WITHDREW      → downward cascade, upstream detaches
//   CHAIN_COLLAPSE_ABOVE → no local cascade (upstream already cascading),
//                          downstream detaches
//   OTHER                → both directions cascade, no detachment
const WITHDRAWAL_REASONS: Array<{
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

type Props = {
  transactionId: string;
  currentStatus: TransactionStatus;
  /** True when the transaction is part of a chain. Used to tail the
   *  withdraw success toast with "— chain notified" only when relevant. */
  inChain?: boolean;
};

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateInput(d);
}

export function StatusControl({ transactionId, currentStatus, inChain = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useAgentToast();
  // Modals are portal'd to document.body — the agent CSS variables
  // (--agent-surface-elevated, --agent-text-primary, etc.) are scoped
  // to elements carrying data-theme. Without these attributes on the
  // portal root, the variables resolve to "" and the modal renders
  // with NO background → text floating over the page (Ellis screenshot).
  const { theme, isNight } = usePortalTheme();
  const [open, setOpen]             = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [holdDate, setHoldDate]     = useState("");
  // Optional "why is this going on hold" — stored on the hold period and
  // shown on the hub's holds-needing-attention card.
  const [holdReason, setHoldReason] = useState("");
  // Closed-loop arc (2026-06-05): the withdraw modal now collects a
  // structured WithdrawalReason (drives chain cascade direction) AND a
  // free-text detail (the existing fallThroughReason — preserved for
  // audit). `pickedReason` holds the radio selection; `detailText` holds
  // the free-text follow-up.
  const [pickedReason, setPickedReason] = useState<WithdrawalReason | "">("");
  const [detailText, setDetailText]     = useState("");

  // Manual optimistic state — persists across the post-action gap
  // before the parent currentStatus prop refreshes. useOptimistic's
  // post-transition behaviour reverts to the (still-stale) prop, making
  // the badge flicker back to "Active" for a moment.
  const [optimisticStatus, setOptimisticStatus] = useState<TransactionStatus>(currentStatus);
  useEffect(() => {
    setOptimisticStatus(currentStatus);
  }, [currentStatus]);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // The status menu renders through a portal on document.body, which sits
  // OUTSIDE .agent-shell-root — so the --agent-* dark tokens don't inherit
  // there. Read the light/dark axis (data-theme on <html>) directly and pick
  // explicit values below. Mirrors components/decor/AppBackground.
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  function handleOpen() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  }

  function selectStatus(next: TransactionStatus) {
    if (next === currentStatus) { setOpen(false); return; }
    setOpen(false);
    if (next === "withdrawn") {
      setPickedReason("");
      setDetailText("");
      setShowModal(true);
      return;
    }
    if (next === "on_hold") {
      // Ask for a return date so the file resurfaces in the hub's expired-
      // holds card when due. Or "indefinitely" — same as passing null.
      setHoldDate("");
      setHoldReason("");
      setShowHoldModal(true);
      return;
    }
    // Coming off hold? Ask whether to resume client-email automation
    // before flipping status. The two flows are independent server-side
    // (status is on PropertyTransaction; emails are gated by
    // clientEmailsPaused) — this prompt makes the user-facing choice
    // explicit so they're not surprised when automation springs back on.
    if (next === "active" && currentStatus === "on_hold") {
      setShowResumeModal(true);
      return;
    }
    applyStatus(next, null, null);
  }

  function applyStatus(
    status: TransactionStatus,
    fallThroughReason: string | null,
    plannedEndAt: Date | null,
    withdrawalReason: WithdrawalReason | null = null,
    reasonForHold: string | null = null,
  ) {
    setSaving(true);
    // Pre-transition optimistic flip so the badge updates the instant the
    // modal closes — without waiting for the action's await to resolve.
    setOptimisticStatus(status);
    startTransition(async () => {
      try {
        await changeStatusAction(transactionId, status, fallThroughReason, plannedEndAt, withdrawalReason, reasonForHold);
        const label =
          status === "active"    ? "File active" :
          status === "on_hold"   ? "File on hold" :
          status === "completed" ? "File completed" :
          status === "withdrawn" ? (inChain ? "Withdrawn, chain notified" : "Withdrawn") :
          "Status updated";
        toast.success(label);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.startsWith("Cannot mark as completed")) {
          toast.error(msg);
        } else {
          toast.error("Couldn't update status. Try again");
        }
      } finally {
        setSaving(false);
      }
    });
  }

  function confirmWithdrawal() {
    if (!pickedReason) return;
    // Free-text detail is optional. When omitted, fallThroughReason takes
    // the human label of the chosen reason so the file's history still
    // reads naturally (e.g. "Our buyer pulled out") rather than the enum
    // value. When supplied, the agent's text wins.
    const labelByValue = Object.fromEntries(WITHDRAWAL_REASONS.map((r) => [r.value, r.label]));
    const finalReason = detailText.trim() || labelByValue[pickedReason] || null;
    setShowModal(false);
    applyStatus("withdrawn", finalReason, null, pickedReason);
  }

  function resumeWithAutomation() {
    setShowResumeModal(false);
    applyStatus("active", null, null);
  }
  function resumeKeepingEmailsPaused() {
    setShowResumeModal(false);
    // Flip to active first, then immediately pause client emails so
    // chases stay off. Both actions are idempotent / quick.
    applyStatus("active", null, null);
    pauseClientEmails(transactionId).catch(() => {});
  }

  // True when the typed/picked date is today or earlier. The browser's
  // `min` attribute only constrains the picker UI — users can still type
  // a past date by hand, so we also guard here (and the server rejects
  // too, as final defence).
  const holdDateInPast = holdDate !== "" && holdDate < tomorrow();

  function confirmHoldDate() {
    if (!holdDate || holdDateInPast) return;
    const d = new Date(holdDate);
    d.setHours(9, 0, 0, 0);
    setShowHoldModal(false);
    applyStatus("on_hold", null, d, null, holdReason.trim() || null);
  }
  function confirmHoldIndefinite() {
    setShowHoldModal(false);
    applyStatus("on_hold", null, null, null, holdReason.trim() || null);
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleOpen}
          disabled={saving || isPending}
          className="flex items-center gap-1.5 group"
          title="Change status"
        >
          <StatusBadge status={optimisticStatus} />
          <svg
            className="w-3 h-3 text-slate-900/30 group-hover:text-slate-900/60 flex-shrink-0"
            style={{ transition: "transform 180ms ease, color 150ms", transform: open ? "rotate(180deg)" : undefined }}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && dropdownPos && createPortal(
          <>
            <div className="fixed inset-0" style={{ zIndex: 1499 }} onClick={() => setOpen(false)} />
            <div
              className="fixed agent-dropdown-in rounded-xl overflow-hidden min-w-[140px]"
              style={{
                zIndex: 1500, top: dropdownPos.top, left: dropdownPos.left,
                // Portal-nav-style frosted glass (matches PortalShell bottom
                // nav): translucent so the backdrop shines through, hairline
                // border, strong blur. Explicit light/dark values because this
                // is portaled outside the token scope (see isDark above).
                background: isDark ? "rgba(20, 28, 44, 0.72)" : "rgba(255, 255, 255, 0.82)",
                backdropFilter: "blur(24px) saturate(1.8)",
                WebkitBackdropFilter: "blur(24px) saturate(1.8)",
                border: isDark ? "0.5px solid rgba(255, 255, 255, 0.12)" : "0.5px solid rgba(15, 23, 42, 0.08)",
                boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.45)" : "0 8px 40px rgba(15,23,42,0.14)",
              }}
            >
              {STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => selectStatus(value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                    value === optimisticStatus ? "font-medium" : ""
                  }`}
                  style={{
                    background: "transparent",
                    color: value === optimisticStatus
                      ? (isDark ? "#EFF6FF" : "rgba(15,23,42,0.9)")
                      : (isDark ? "rgba(226,232,240,0.72)" : "rgba(15,23,42,0.7)"),
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {value === optimisticStatus && (
                    <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span className={value === optimisticStatus ? "" : "pl-5"}>{label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      </div>

      {/* ── Withdrawal reason modal ────────────────────────────── */}
      {showModal && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 1500 }}
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl w-full max-w-sm p-6"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Mark as withdrawn</p>
                <p className="text-xs text-slate-500">Record why this sale fell through</p>
              </div>
            </div>

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
                  <>Agents on <strong>both sides</strong> of the chain will be notified. The chain stays connected for now — they decide their own next step.</>
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
                onClick={() => setShowModal(false)}
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
        </div>,
        document.body
      )}

      {/* ── On-hold date modal — matches AddFirmModal chrome ──── */}
      {showHoldModal && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night"
          style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" onClick={() => setShowHoldModal(false)} />

          <div
            className="rounded-2xl w-full max-w-md"
            style={{
              position: "relative",
              zIndex: 1,
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Put file on hold</h2>
              <button type="button" onClick={() => setShowHoldModal(false)} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">×</button>
            </div>

            <div className="px-6 py-5">
              <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                Pick a return date and we&apos;ll surface this file on the hub when it&apos;s due — so it doesn&apos;t get forgotten.
              </p>

              <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                Return date
              </label>
              <input
                type="date"
                value={holdDate}
                onChange={(e) => setHoldDate(e.target.value)}
                min={tomorrow()}
                autoFocus
                className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
              />
              {holdDateInPast && (
                <p style={{ fontSize: 11, color: "#b45309", margin: "6px 0 0", fontWeight: 500 }}>
                  Pick a future date — the file needs to come back to you, not behind you.
                </p>
              )}

              <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5 mt-4">
                Reason <span style={{ color: "rgba(15,23,42,0.4)", fontWeight: 400 }}>&nbsp;(optional)</span>
              </label>
              <input
                type="text"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                maxLength={500}
                placeholder="Waiting for buyer searches, probate, chain issue…"
                className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
              />

              <div className="flex gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setShowHoldModal(false)}
                  className="px-4 py-2.5 text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmHoldDate}
                  disabled={!holdDate || holdDateInPast}
                  className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
                >
                  Put on hold
                </button>
              </div>

              <button
                type="button"
                onClick={confirmHoldIndefinite}
                className="w-full mt-3 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Or hold indefinitely (won&apos;t auto-surface)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Resume-automation modal — matches AddFirmModal chrome ── */}
      {showResumeModal && createPortal(
        <div
          data-theme={theme}
          data-night={isNight ? "" : undefined}
          className="nv2-night"
          style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" onClick={() => setShowResumeModal(false)} style={{ zIndex: 0 }} />

          <div
            className="rounded-2xl w-full max-w-md"
            style={{
              position: "relative",
              zIndex: 1,
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Take off hold</h2>
              <button type="button" onClick={() => setShowResumeModal(false)} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">×</button>
            </div>

            <div className="px-6 py-5 space-y-3">
              <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>
                Pick one — you can always change later.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <ResumeOptionCard
                  title="Resume automation"
                  description="Client chase emails, reminders + escalations restart from where they left off."
                  onClick={resumeWithAutomation}
                />
                <ResumeOptionCard
                  title="Reactivate, keep emails paused"
                  description="File is active again but no client emails fire. Manual chasing only. Flip back on from the file's email settings any time."
                  onClick={resumeKeepingEmailsPaused}
                />
              </div>
            </div>

            <div style={{ padding: "0 20px 16px", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                className="agent-link"
                style={{ padding: "10px 6px", fontSize: 13, fontWeight: 500 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Tappable option card used inside the Resume modal — mirrors the
// AutomationStopModal's ChooserCard pattern so the two-path UX feels
// the same across surfaces.
function ResumeOptionCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "12px 14px",
        background: "var(--agent-surface-glass)",
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 12,
        cursor: "pointer",
        transition: "background 150ms, border-color 150ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--agent-hover-tint, rgba(255,107,74,0.06))";
        e.currentTarget.style.borderColor = "rgba(255,107,74,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--agent-surface-glass)";
        e.currentTarget.style.borderColor = "var(--agent-border-default)";
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>{title}</p>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.5, margin: "4px 0 0" }}>{description}</p>
    </button>
  );
}
