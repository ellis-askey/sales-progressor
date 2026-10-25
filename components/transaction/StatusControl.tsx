"use client";
// components/transaction/StatusControl.tsx

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { changeStatusAction } from "@/app/actions/transactions";
import { pauseClientEmails } from "@/app/actions/automation";
import { WithdrawFileModal } from "@/components/transaction/WithdrawFileModal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import type { TransactionStatus, WithdrawalReason } from "@prisma/client";
import { DateField } from "@/components/ui/DateField";

const STATUSES: { value: TransactionStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

// Structured withdrawal reasons + the withdraw modal now live in
// components/transaction/WithdrawFileModal.tsx (extracted 2026-09-18 so the
// hub's Files-to-review card shares the exact same flow).

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
  // Phase 2 (2026-09-17): the trigger is gated on ack-scoped `saving` only —
  // isPending would keep it disabled through the whole post-ack re-render.
  const [, startTransition] = useTransition();
  const { toast } = useAgentToast();
  // Modals are portal'd to document.body — the agent CSS variables
  // (--agent-surface-elevated, --agent-text-primary, etc.) are scoped
  // to elements carrying data-theme. Without these attributes on the
  // portal root, the variables resolve to "" and the modal renders
  // with NO background → text floating over the page (Ellis screenshot).
  const { theme, isNight } = usePortalTheme();
  const [saving, setSaving]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [holdDate, setHoldDate]     = useState("");
  // Optional "why is this going on hold" — stored on the hold period and
  // shown on the hub's holds-needing-attention card.
  const [holdReason, setHoldReason] = useState("");
  // Closed-loop arc (2026-06-05): the withdraw modal collects a structured
  // WithdrawalReason (drives chain cascade direction) AND a free-text detail
  // (the existing fallThroughReason — preserved for audit). Both now
  // collected inside WithdrawFileModal.

  // Manual optimistic state — persists across the post-action gap
  // before the parent currentStatus prop refreshes. useOptimistic's
  // post-transition behaviour reverts to the (still-stale) prop, making
  // the badge flicker back to "Active" for a moment.
  const [optimisticStatus, setOptimisticStatus] = useState<TransactionStatus>(currentStatus);
  useEffect(() => {
    setOptimisticStatus(currentStatus);
  }, [currentStatus]);

  function selectStatus(next: TransactionStatus) {
    if (next === currentStatus) return;
    if (next === "withdrawn") {
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
        <Popover
          preset="menu"
          placement="bottom-start"
          trigger={(open) => (
            <button
              disabled={saving}
              className="flex items-center gap-1.5 group"
              title="Change status"
              aria-expanded={open}
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
          )}
        >
          {(close) => STATUSES.map(({ value, label }) => {
            const sel = value === optimisticStatus;
            return (
              <PopoverMenuItem
                key={value}
                icon={sel
                  ? <svg style={{ width: 14, height: 14, color: "#3b82f6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  : <span style={{ display: "inline-block", width: 14 }} />}
                onClick={() => { close(); selectStatus(value); }}
              >
                <span style={{ fontWeight: sel ? 600 : 500 }}>{label}</span>
              </PopoverMenuItem>
            );
          })}
        </Popover>
      </div>

      {/* ── Withdrawal reason modal (shared — see WithdrawFileModal) ── */}
      {showModal && (
        <WithdrawFileModal
          inChain={inChain}
          onCancel={() => setShowModal(false)}
          onConfirm={(reason, finalReason) => {
            setShowModal(false);
            applyStatus("withdrawn", finalReason, null, reason);
          }}
        />
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
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100dvh - 48px)",
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — Ribbon coral band */}
            <div style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <SheetBandHeader kicker="On hold" title="Put file on hold" />
              <button
                type="button"
                onClick={() => setShowHoldModal(false)}
                aria-label="Close"
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 10, fontSize: 20, lineHeight: 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >×</button>
            </div>

            <div className="px-6 py-5" style={{ overflowY: "auto", minHeight: 0 }}>
              <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                Pick a return date and we&apos;ll surface this file on the hub when it&apos;s due — so it doesn&apos;t get forgotten.
              </p>

              <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                Return date
              </label>
              <DateField
                value={holdDate}
                onChange={(e) => setHoldDate(e.target.value)}
                min={tomorrow()}
                autoFocus
                className="agent-input"
                wrapperStyle={{ display: "inline-block" }}
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
                className="agent-input"
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
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100dvh - 48px)",
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — Ribbon coral band */}
            <div style={{ ...SHEET_BAND_STYLE, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <SheetBandHeader kicker="Reactivate" title="Take off hold" />
              <button
                type="button"
                onClick={() => setShowResumeModal(false)}
                aria-label="Close"
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 10, fontSize: 20, lineHeight: 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  border: "none", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer",
                  transition: "background 150ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >×</button>
            </div>

            <div className="px-6 py-5 space-y-3" style={{ overflowY: "auto", minHeight: 0 }}>
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
