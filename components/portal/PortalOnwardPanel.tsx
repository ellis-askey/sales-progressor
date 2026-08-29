"use client";

// Onward-Purchase / Related-Sale portal panel.
//
// One panel, two directions (Law 4, reuse not duplicate):
//   - direction="onward" (default): a SELLER's onward purchase, above them. Tracks
//     the purchaser (PM) steps, onward voice (lib/onward-copy.ts), with the
//     mortgage + survey axes a buyer has. Actions: app/actions/portal-onward.ts.
//   - direction="related": a BUYER's related sale, below them (the property they're
//     selling to fund their purchase). Tracks the vendor (VM) steps, seller voice
//     about "your sale" (lib/related-sale-copy.ts). No purchase-type / survey /
//     mortgage axis. Actions: app/actions/portal-related-sale.ts.
//
// Rendered as the third swipe panel on the Progress tab, opposite the other side's
// view. Writes to the shadow tracker (source=seller / source=buyer).
//
// Spec: docs/active/onward-visibility/00-discovery.md + docs/active/related-sale/00-spec.md.

import { useState, useEffect, useTransition } from "react";
import { P, PortalPill, PURCHASER_GROUPS, VENDOR_GROUPS } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { PortalSheet } from "./PortalSheet";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { onwardStepLabel, onwardStepSubtext } from "@/lib/onward-copy";
import { relatedSaleStepLabel, relatedSaleStepSubtext } from "@/lib/related-sale-copy";
import {
  portalSetOnwardTypeFactsAction,
  portalConfirmOnwardStepAction,
  portalUndoOnwardStepAction,
  portalReactivateOnwardAction,
  portalGetOnwardTrackerAction,
  portalSkipOnwardSurveyAction,
} from "@/app/actions/portal-onward";
import {
  portalSetRelatedSaleTypeFactsAction,
  portalConfirmRelatedSaleStepAction,
  portalUndoRelatedSaleStepAction,
  portalReactivateRelatedSaleAction,
  portalGetRelatedSaleAction,
} from "@/app/actions/portal-related-sale";

// Open the shared manage drawer (change place / no longer buying) — the same
// stacked bottom-sheet the Settings edits use. Onward direction only; the related
// sale has no shell edit-drawer yet, so it just offers "pick it back up".
function openOnwardChangeDrawer() {
  window.dispatchEvent(new CustomEvent("portal:open-edit-drawer", {
    detail: { kind: "onward-change", mode: "change", direction: "above", initial: {} },
  }));
}
import type { OnwardTrackerView, OnwardStepView } from "@/lib/services/onward";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";
type Direction = "onward" | "related";

function ukDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PortalOnwardPanel({
  token,
  initialView,
  onwardAddress,
  direction = "onward",
}: {
  token: string;
  initialView: OnwardTrackerView;
  onwardAddress?: string | null;
  direction?: Direction;
}) {
  const isRelated = direction === "related";

  // Direction-specific copy, groups, gate code, actions and wording.
  const stepLabel = isRelated ? relatedSaleStepLabel : onwardStepLabel;
  const stepSubtext = isRelated ? relatedSaleStepSubtext : onwardStepSubtext;
  const GROUPS = isRelated ? VENDOR_GROUPS : PURCHASER_GROUPS;
  const gateCode = isRelated ? "VM18" : "PM25";
  const surveyCode = isRelated ? null : "PM9";

  const txt = isRelated
    ? {
        supersededTitle: "Your sale is now managed for you",
        supersededBody:
          "The agent looking after the property you're selling has taken this on, so these updates now come from them. There's nothing you need to do here.",
        abandonedTitle: "Your sale is no longer going ahead",
        abandonedBody:
          "You told us the property you're selling isn't going ahead. If that changes, pick it back up.",
        setupTitle: onwardAddress ?? "Your sale",
        setupBody: "Tell us about the property you're selling so we can show you the right steps.",
        retiredError: "This is now handled by the agent looking after the property you're selling.",
      }
    : {
        supersededTitle: "Your onward is now managed for you",
        supersededBody:
          "The agent looking after the property you're buying has taken this on, so these updates now come from them. There's nothing you need to do here.",
        abandonedTitle: "You're no longer buying onward",
        abandonedBody:
          "You told us your onward purchase isn't going ahead. If that changes, pick your previous one back up or set up somewhere new.",
        setupTitle: onwardAddress ?? "Your onward purchase",
        setupBody: "Tell us about the property you're buying so we can show you the right steps.",
        retiredError: "This is now handled by the agent looking after the property you're buying.",
      };

  function blockingLabel(step: OnwardStepView, byCode: Map<string, OnwardStepView>): string {
    if (step.code === gateCode) return "the steps above";
    const prereqs = DIRECT_PREREQUISITES[step.code] ?? [];
    for (const p of prereqs) {
      const s = byCode.get(p);
      if (s && !s.isComplete) return stepLabel(s.code, s.name).toLowerCase();
    }
    return "an earlier step";
  }

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

  // The onward manage drawer (change place / no longer buying) lives at the shell
  // level; refetch when it saves so this panel reflects the change. Related sale
  // has no shell drawer, so this listener is a no-op there.
  useEffect(() => {
    if (isRelated) return;
    const onUpdated = () => { portalGetOnwardTrackerAction(token).then((v) => { if (v) setView(v); }); };
    window.addEventListener("portal:onward-updated", onUpdated);
    return () => window.removeEventListener("portal:onward-updated", onUpdated);
  }, [token, isRelated]);

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

  function reactivate() {
    return run(() => (isRelated ? portalReactivateRelatedSaleAction(token) : portalReactivateOnwardAction(token)));
  }

  const confirmingStep = confirmingCode ? view.steps.find((s) => s.code === confirmingCode) ?? null : null;
  function closeSheet() { if (!pending) setConfirmingCode(null); }

  function doConfirm(code: string) {
    run(async () => {
      const r = isRelated
        ? await portalConfirmRelatedSaleStepAction({ token, milestoneCode: code, eventDate: confirmDate || null })
        : await portalConfirmOnwardStepAction({ token, milestoneCode: code, eventDate: confirmDate || null });
      if (r && r.result.ok === false) {
        setError(
          r.result.reason === "locked"
            ? "Confirm the earlier step first."
            : r.result.reason === "awaiting_our_completion"
              ? "Your onward can't complete until this sale completes."
              : r.result.reason === "retired"
                ? txt.retiredError
                : "We couldn't confirm this step.",
        );
      } else {
        setConfirmingCode(null);
      }
      return r?.view ?? null;
    });
  }

  // ── Superseded: the agent handling the other-side property now owns these
  //    updates (their real file took over from this reported stand-in). ─────────
  if (view.status === "superseded") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl px-5 py-5" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <p className="text-[15px] font-semibold mb-1" style={{ color: P.textPrimary }}>{txt.supersededTitle}</p>
          <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>{txt.supersededBody}</p>
        </div>
      </div>
    );
  }

  // ── Abandoned: they said it's no longer going ahead ─────────────────────────
  if (view.status === "abandoned") {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl px-5 py-5" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <p className="text-[15px] font-semibold mb-1" style={{ color: P.textPrimary }}>{txt.abandonedTitle}</p>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>{txt.abandonedBody}</p>
          <div className="flex flex-col gap-2">
            <PortalButton size="sm" full={false} loading={pending} onClick={reactivate}>
              Pick it back up
            </PortalButton>
            {!isRelated && (
              <button
                type="button"
                onClick={openOnwardChangeDrawer}
                className="text-left text-[13px] font-semibold"
                style={{ color: P.primary, background: "none", border: "none", padding: "4px 0", cursor: "pointer" }}
              >
                I&apos;m buying somewhere new
              </button>
            )}
          </div>
          {error && <p className="text-[12px] mt-2" style={{ color: P.warning }}>{error}</p>}
        </div>
      </div>
    );
  }

  // ── Setup: the type facts (covers the not-yet-created case too) ──────────────
  if (!view.typeFactsSet) {
    const canSave = tenure !== null && (isRelated || purchaseType !== null) && !pending;
    return (
      <div className="space-y-3">
        <div className="rounded-2xl px-5 py-5" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
          <p className="text-[15px] font-semibold mb-1" style={{ color: P.textPrimary }}>{txt.setupTitle}</p>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>{txt.setupBody}</p>

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
          {!isRelated && (
            <FactRow label="How you're buying">
              <Pill on={purchaseType === "mortgage"} onClick={() => setPurchaseType("mortgage")}>Mortgage</Pill>
              <Pill on={purchaseType === "cash_buyer"} onClick={() => setPurchaseType("cash_buyer")}>Cash</Pill>
              <Pill on={purchaseType === "cash_from_proceeds"} onClick={() => setPurchaseType("cash_from_proceeds")}>Cash from this sale</Pill>
            </FactRow>
          )}

          <PortalButton
            size="sm"
            full={false}
            loading={pending}
            disabled={!canSave}
            onClick={() =>
              run(() =>
                isRelated
                  ? portalSetRelatedSaleTypeFactsAction({ token, tenure: tenure as Tenure, isShareOfFreehold: shareOfFreehold })
                  : portalSetOnwardTypeFactsAction({
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

  // ── Steps, grouped like the matching own-sale / own-purchase panel ───────────
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
      {GROUPS.map((group) => {
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
                  const label = stepLabel(step.code, step.name);
                  const subtext = stepSubtext(step.code);
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
                                  const r = isRelated
                                    ? await portalUndoRelatedSaleStepAction({ token, milestoneCode: step.code })
                                    : await portalUndoOnwardStepAction({ token, milestoneCode: step.code });
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
                              {surveyCode && step.code === surveyCode && (
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

      {!isRelated && view.surveySkipped && (
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

      {/* Skip-survey confirm — onward direction only. */}
      {!isRelated && (
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
      )}

      {/* Confirm drawer — slides up + down via PortalSheet. Phrased for the tracked
          purchase (onward) or sale (related) via the shared copy modules. */}
      <PortalSheet open={!!confirmingStep} onClose={closeSheet} closeDisabled={pending}>
        {confirmingStep && (
          <div className="px-6 pb-6 pt-2">
            <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
              {stepLabel(confirmingStep.code, confirmingStep.name)}
            </p>
            {stepSubtext(confirmingStep.code) && (
              <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
                {stepSubtext(confirmingStep.code)}
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
