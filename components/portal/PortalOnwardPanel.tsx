"use client";

// Onward-Purchase Visibility arc — Stage 2 v2 seller-portal panel.
//
// The seller's onward-purchase progress, rendered as the third panel on the
// Progress tab (swipe opposite the buyer view). Grouped the same way as the
// seller's own sale steps (PURCHASER_GROUPS), with onward-specific voice
// (lib/onward-copy.ts). Writes to the shadow tracker (source=seller).
//
// Spec: docs/active/onward-visibility/00-discovery.md.

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { P, PortalPill, PURCHASER_GROUPS } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { onwardStepLabel, onwardStepSubtext } from "@/lib/onward-copy";
import {
  portalSetOnwardTypeFactsAction,
  portalConfirmOnwardStepAction,
  portalUndoOnwardStepAction,
  portalAbandonOnwardAction,
  portalReactivateOnwardAction,
  portalResetOnwardAction,
} from "@/app/actions/portal-onward";
import type { OnwardTrackerView, OnwardStepView } from "@/lib/services/onward";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

function ukDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function blockingLabel(step: OnwardStepView, byCode: Map<string, OnwardStepView>): string {
  if (step.code === "PM25") return "the steps above";
  const prereqs = DIRECT_PREREQUISITES[step.code] ?? [];
  for (const p of prereqs) {
    const s = byCode.get(p);
    if (s && !s.isComplete) return onwardStepLabel(s.code, s.name).toLowerCase();
  }
  return "an earlier step";
}

export function PortalOnwardPanel({
  token,
  initialView,
  onwardAddress,
}: {
  token: string;
  initialView: OnwardTrackerView;
  onwardAddress?: string | null;
}) {
  const [view, setView] = useState<OnwardTrackerView>(initialView);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tenure, setTenure] = useState<Tenure | null>(initialView.tenure);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(initialView.purchaseType);
  const [shareOfFreehold, setShareOfFreehold] = useState(initialView.isShareOfFreehold);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState("");
  const [manageAction, setManageAction] = useState<"reset" | "abandon" | null>(null);

  // Lock the page behind while the confirm sheet is open.
  useEffect(() => {
    if (!confirmingCode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [confirmingCode]);

  function run(fn: () => Promise<OnwardTrackerView | null>) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await fn();
        if (next) setView(next);
        else setError("We couldn't save that. Try again.");
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  const confirmingStep = confirmingCode ? view.steps.find((s) => s.code === confirmingCode) ?? null : null;
  function closeSheet() { if (!pending) setConfirmingCode(null); }

  function doConfirm(code: string) {
    run(async () => {
      const r = await portalConfirmOnwardStepAction({ token, milestoneCode: code, eventDate: confirmDate || null });
      if (r && r.result.ok === false) {
        setError(
          r.result.reason === "locked"
            ? "Confirm the earlier step first."
            : r.result.reason === "awaiting_our_completion"
              ? "Your onward can't complete until this sale completes."
              : "We couldn't confirm this step.",
        );
      } else {
        setConfirmingCode(null);
      }
      return r?.view ?? null;
    });
  }

  // ── Abandoned: they said they're no longer buying onward ────────────────────
  if (view.status === "abandoned") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl px-5 py-5" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <p className="text-[15px] font-semibold mb-1" style={{ color: P.textPrimary }}>You&apos;re no longer buying onward</p>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
            You told us your onward purchase isn&apos;t going ahead. If that changes, you can pick it back up.
          </p>
          <PortalButton size="sm" full={false} loading={pending} onClick={() => run(() => portalReactivateOnwardAction(token))}>
            Start again
          </PortalButton>
          {error && <p className="text-[12px] mt-2" style={{ color: P.warning }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Setup: the two type facts (covers the not-yet-created case too) ──────────
  if (!view.typeFactsSet) {
    const canSave = tenure !== null && purchaseType !== null && !pending;
    return (
      <div className="space-y-3">
        <div className="rounded-2xl px-5 py-5" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <p className="text-[15px] font-semibold mb-1" style={{ color: P.textPrimary }}>
            {onwardAddress ?? "Your onward purchase"}
          </p>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
            {onwardAddress
              ? "Just two quick details about the place you're buying, so we show the right steps. Keeping this up to date helps the whole chain move."
              : "Tell us about the place you're buying, so we show the right steps. Keeping this up to date helps the whole chain move."}
          </p>

          <FactRow label="Property type">
            <Pill on={tenure === "freehold"} onClick={() => { setTenure("freehold"); setShareOfFreehold(false); }}>Freehold</Pill>
            <Pill on={tenure === "leasehold"} onClick={() => setTenure("leasehold")}>Leasehold</Pill>
          </FactRow>
          {tenure === "leasehold" && (
            <label className="flex items-center gap-2 mb-3 text-[13px]" style={{ color: P.textSecondary }}>
              <input type="checkbox" checked={shareOfFreehold} onChange={(e) => setShareOfFreehold(e.target.checked)} />
              Share of freehold
            </label>
          )}
          <FactRow label="How you're buying">
            <Pill on={purchaseType === "mortgage"} onClick={() => setPurchaseType("mortgage")}>Mortgage</Pill>
            <Pill on={purchaseType === "cash_buyer"} onClick={() => setPurchaseType("cash_buyer")}>Cash</Pill>
            <Pill on={purchaseType === "cash_from_proceeds"} onClick={() => setPurchaseType("cash_from_proceeds")}>Cash from this sale</Pill>
          </FactRow>

          <PortalButton
            size="sm"
            full={false}
            loading={pending}
            disabled={!canSave}
            onClick={() =>
              run(() =>
                portalSetOnwardTypeFactsAction({
                  token,
                  tenure: tenure as Tenure,
                  purchaseType: purchaseType as PurchaseType,
                  isShareOfFreehold: shareOfFreehold,
                }),
              )
            }
          >
            Save
          </PortalButton>
          {error && <p className="text-[12px] mt-2" style={{ color: P.warning }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Steps, grouped like the seller's own sale panel ─────────────────────────
  const byCode = new Map(view.steps.map((s) => [s.code, s]));

  return (
    <div className="space-y-3">
      {onwardAddress && (
        <p className="text-[14px] font-semibold px-1" style={{ color: P.textPrimary }}>{onwardAddress}</p>
      )}
      <p className="text-[12px] px-1" style={{ color: P.textMuted }}>
        As reported by you. {view.completeCount} of {view.applicableCount} confirmed.
      </p>

      {PURCHASER_GROUPS.map((group) => {
        const steps = group.codes.map((c) => byCode.get(c)).filter((s): s is OnwardStepView => !!s);
        if (steps.length === 0) return null;
        const doneCount = steps.filter((s) => s.isComplete).length;
        const total = steps.length;
        const allDone = doneCount === total;
        const activeGroup = steps.some((s) => !s.isComplete && s.isAvailable);
        const isOpen = expanded[group.label] ?? activeGroup;
        const headerBg = allDone ? P.successBg : activeGroup ? P.accentBg : "transparent";

        return (
          <div key={group.label} className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              style={{ background: headerBg, borderBottom: isOpen ? `1px solid ${P.border}` : undefined }}
              onClick={() => setExpanded((p) => ({ ...p, [group.label]: !isOpen }))}
            >
              <span className="text-xl flex-shrink-0">{group.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>{group.label}</p>
                <p className="text-[12px] mt-0.5" style={{ color: P.textSecondary }}>
                  {allDone ? "All confirmed" : `${doneCount} of ${total} confirmed`}
                </p>
              </div>
              <PortalPill tone={allDone ? "green" : "coral"}>{doneCount}/{total}</PortalPill>
            </button>

            {isOpen && (
              <div>
                {steps.map((step, i) => {
                  const locked = !step.isComplete && !step.isAvailable;
                  const label = onwardStepLabel(step.code, step.name);
                  const subtext = onwardStepSubtext(step.code);
                  return (
                    <div key={step.code} style={{ borderTop: i > 0 ? `1px solid ${P.border}` : undefined, opacity: locked ? 0.4 : 1 }}>
                      <div className="flex items-start gap-3.5 px-5 py-4">
                        <span
                          aria-hidden
                          style={{
                            marginTop: 5, width: 9, height: 9, borderRadius: 999, flexShrink: 0,
                            background: step.isComplete ? P.success : step.isAvailable ? P.primary : "transparent",
                            border: step.isComplete || step.isAvailable ? "none" : `1.5px solid ${P.textMuted}`,
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium leading-snug" style={{ color: step.isComplete ? P.textMuted : P.textPrimary, textDecoration: step.isComplete ? "line-through" : "none" }}>
                            {label}
                          </p>
                          {step.isComplete ? (
                            <p className="text-[12px] mt-0.5" style={{ color: P.success }}>
                              Confirmed{step.eventDate ? ` · ${ukDate(step.eventDate)}` : ""}
                            </p>
                          ) : locked ? (
                            <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>Waiting on {blockingLabel(step, byCode)}</p>
                          ) : subtext ? (
                            <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>{subtext}</p>
                          ) : null}
                        </div>
                        <div className="flex-shrink-0 self-center">
                          {step.isComplete ? (
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  const r = await portalUndoOnwardStepAction({ token, milestoneCode: step.code });
                                  if (r && r.result.ok === false && r.result.reason === "has_dependents") setError("Undo the later step first.");
                                  return r?.view ?? null;
                                })
                              }
                              className="text-[12px] font-semibold"
                              style={{ color: P.textMuted, background: "none", border: "none", padding: "4px 2px", cursor: "pointer" }}
                            >
                              Undo
                            </button>
                          ) : step.isAvailable ? (
                            <PortalButton size="sm" full={false} onClick={() => { setConfirmingCode(step.code); setConfirmDate(""); setError(null); }}>
                              Confirm
                            </PortalButton>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-[12px] px-1" style={{ color: P.warning }}>{error}</p>}

      {/* Manage: onward changed, or no longer happening */}
      <div className="px-1 pt-3">
        {manageAction === null ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { setManageAction("reset"); setError(null); }}
              className="text-left text-[12px] font-medium"
              style={{ color: P.textMuted, background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              My onward has changed to a different place
            </button>
            <button
              type="button"
              onClick={() => { setManageAction("abandon"); setError(null); }}
              className="text-left text-[12px] font-medium"
              style={{ color: P.textMuted, background: "none", border: "none", padding: 0, cursor: "pointer" }}
            >
              I&apos;m no longer buying onward
            </button>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-3" style={{ background: P.pageBg }}>
            <p className="text-[13px] mb-2" style={{ color: P.textSecondary }}>
              {manageAction === "reset"
                ? "Reset your onward steps so you can add the new place? Your current progress will be cleared."
                : "Mark your onward as no longer going ahead?"}
            </p>
            <div className="flex gap-2 items-center">
              <PortalButton
                size="sm"
                full={false}
                loading={pending}
                onClick={() =>
                  run(async () => {
                    const next = manageAction === "reset"
                      ? await portalResetOnwardAction(token)
                      : await portalAbandonOnwardAction(token);
                    setManageAction(null);
                    return next;
                  })
                }
              >
                {manageAction === "reset" ? "Yes, reset" : "Yes"}
              </PortalButton>
              <button
                type="button"
                disabled={pending}
                onClick={() => setManageAction(null)}
                className="text-[13px] font-semibold"
                style={{ color: P.textMuted, background: "none", border: "none", padding: "8px 10px", cursor: "pointer" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm drawer — matches the buyer step confirmation drawer, phrased for
          the seller's onward purchase. Slides up, title + subtext + confirm. */}
      {confirmingStep && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeSheet}>
          <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.35)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div
            className="portal-sheet relative w-full max-w-lg mx-auto"
            style={{
              background: P.cardBg,
              borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`,
              boxShadow: P.shadowXl,
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
            </div>
            <button
              onClick={closeSheet}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="px-6 pb-6 pt-2">
              <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
                {onwardStepLabel(confirmingStep.code, confirmingStep.name)}
              </p>
              {onwardStepSubtext(confirmingStep.code) && (
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
                  {onwardStepSubtext(confirmingStep.code)}
                </p>
              )}

              {confirmingStep.eventDateRequired && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
                    When did this happen? <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={confirmDate}
                    onChange={(e) => setConfirmDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                  />
                </div>
              )}

              {error && <p className="text-[13px] mb-3" style={{ color: "#EF4444" }}>{error}</p>}

              <button
                onClick={() => doConfirm(confirmingStep.code)}
                disabled={pending}
                className="w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 transition-opacity"
                style={{ background: P.primary, borderRadius: P.radiusMd }}
              >
                {pending ? "Saving…" : "Confirm"}
              </button>
              <button
                onClick={closeSheet}
                disabled={pending}
                className="w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
                style={{ color: P.textSecondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[12px] mb-1.5" style={{ color: P.textMuted }}>{label}</p>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 13, padding: "7px 13px", borderRadius: 999, cursor: "pointer",
        border: on ? `1px solid ${P.primary}` : `1px solid ${P.border}`,
        background: on ? P.primaryBg : P.cardBg,
        color: on ? P.primaryText : P.textSecondary,
        fontWeight: on ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}
