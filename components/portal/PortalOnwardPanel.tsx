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
import { P, PortalPill, PURCHASER_GROUPS } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { PortalSheet } from "./PortalSheet";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { onwardStepLabel, onwardStepSubtext } from "@/lib/onward-copy";
import {
  portalSetOnwardTypeFactsAction,
  portalConfirmOnwardStepAction,
  portalUndoOnwardStepAction,
  portalReactivateOnwardAction,
  portalGetOnwardTrackerAction,
  portalSkipOnwardSurveyAction,
} from "@/app/actions/portal-onward";

// Open the shared manage drawer (change place / no longer buying) — the same
// stacked bottom-sheet the Settings edits use. Triggers live on the Info tab
// and in Settings too; this one is the abandoned-state shortcut.
function openOnwardChangeDrawer() {
  window.dispatchEvent(new CustomEvent("portal:open-edit-drawer", {
    detail: { kind: "onward-change", mode: "change", direction: "above", initial: {} },
  }));
}
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
  const [skipSheet, setSkipSheet] = useState(false);

  // The manage drawer (change place / no longer buying) lives at the shell
  // level; refetch when it saves so this panel reflects the change.
  useEffect(() => {
    const onUpdated = () => { portalGetOnwardTrackerAction(token).then((v) => { if (v) setView(v); }); };
    window.addEventListener("portal:onward-updated", onUpdated);
    return () => window.removeEventListener("portal:onward-updated", onUpdated);
  }, [token]);

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
            You told us your onward purchase isn&apos;t going ahead. If that changes, pick your previous one back up or set up somewhere new.
          </p>
          <div className="flex flex-col gap-2">
            <PortalButton size="sm" full={false} loading={pending} onClick={() => run(() => portalReactivateOnwardAction(token))}>
              Pick it back up
            </PortalButton>
            <button
              type="button"
              onClick={openOnwardChangeDrawer}
              className="text-left text-[13px] font-semibold"
              style={{ color: P.primary, background: "none", border: "none", padding: "4px 0", cursor: "pointer" }}
            >
              I&apos;m buying somewhere new
            </button>
          </div>
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
            Tell us about the property you&apos;re buying so we can show you the right steps.
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

      <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
      {/* Topper — matches the view-only "The purchase / The sale" card header. */}
      <div className="px-5 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
        <p className="text-[12px]" style={{ color: P.textMuted }}>
          As reported by you. {view.completeCount} of {view.applicableCount} confirmed.
        </p>
      </div>
      {PURCHASER_GROUPS.map((group) => {
        const steps = group.codes.map((c) => byCode.get(c)).filter((s): s is OnwardStepView => !!s);
        if (steps.length === 0) return null;
        const doneCount = steps.filter((s) => s.isComplete).length;
        const total = steps.length;
        const allDone = doneCount === total;
        const activeGroup = steps.some((s) => !s.isComplete && s.isAvailable);
        const isOpen = expanded[group.label] ?? activeGroup;
        const headerBg = allDone ? P.successBg : activeGroup ? P.accentBg : P.pageBg;

        return (
          <div key={group.label}>
            <button
              className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left"
              style={{ background: headerBg, borderBottom: `1px solid ${P.border}` }}
              onClick={() => setExpanded((p) => ({ ...p, [group.label]: !isOpen }))}
            >
              <p className="text-[12px] font-bold uppercase tracking-wide min-w-0 truncate" style={{ color: P.textMuted }}>
                {group.icon} {group.label}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <PortalPill tone={allDone ? "green" : "coral"}>{doneCount}/{total}</PortalPill>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
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
                            <div className="flex flex-col items-end gap-1.5">
                              <PortalButton size="sm" full={false} onClick={() => { setConfirmingCode(step.code); setConfirmDate(""); setError(null); }}>
                                Confirm
                              </PortalButton>
                              {step.code === "PM9" && (
                                <button
                                  type="button"
                                  onClick={() => setSkipSheet(true)}
                                  className="text-[11px] font-medium underline"
                                  style={{ color: P.textMuted, background: "none", border: "none", cursor: "pointer" }}
                                >
                                  Skip survey
                                </button>
                              )}
                            </div>
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
      </div>

      {error && <p className="text-[12px] px-1" style={{ color: P.warning }}>{error}</p>}

      {view.surveySkipped && (
        <p className="text-[12px] px-1" style={{ color: P.textMuted }}>
          You&apos;ve marked the survey as not needed.{" "}
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => portalSkipOnwardSurveyAction(token, false))}
            className="font-semibold underline"
            style={{ color: P.textMuted, background: "none", border: "none", cursor: "pointer" }}
          >
            Undo
          </button>
        </p>
      )}

      {/* "Changed place" and "no longer buying" live on the Information tab and
          in Settings (where the onward is added / edited), not here. */}

      {/* Skip-survey confirm — mirrors the buyer's skip sheet. */}
      <PortalSheet open={skipSheet} onClose={() => setSkipSheet(false)} closeDisabled={pending}>
        <div className="px-6 pb-6 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: P.warning }}>Skip survey</p>
          <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>Not getting a survey?</p>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: P.textSecondary }}>
            We&apos;ll mark the survey steps on your onward as not needed. You can undo this anytime.
          </p>
          <button
            onClick={() => run(async () => { const v = await portalSkipOnwardSurveyAction(token, true); setSkipSheet(false); return v; })}
            disabled={pending}
            className="w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 transition-opacity"
            style={{ background: P.warning, borderRadius: P.radiusMd }}
          >
            {pending ? "Saving…" : "Yes, skip the survey"}
          </button>
          <button
            onClick={() => setSkipSheet(false)}
            disabled={pending}
            className="w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
            style={{ color: P.textSecondary }}
          >
            Cancel
          </button>
        </div>
      </PortalSheet>

      {/* Confirm drawer — matches the buyer step confirmation drawer, phrased for
          the seller's onward purchase. Slides up + down via PortalSheet. */}
      <PortalSheet open={!!confirmingStep} onClose={closeSheet} closeDisabled={pending}>
        {confirmingStep && (
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
        )}
      </PortalSheet>
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
