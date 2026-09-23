"use client";

// Onward-Purchase / Related-Sale agent-side card.
//
// One card, two directions (Law 4, reuse not duplicate):
//   - direction="onward" (default): a SELLER's REPORTED onward-purchase progress
//     (the link above). Tracks purchaser (PM) steps; a buying axis (mortgage/cash).
//   - direction="related": a BUYER's REPORTED related-sale progress (the link
//     below, the property they're selling to fund the purchase). Tracks vendor
//     (VM) steps; tenure only, no buying axis.
//
// Two shells:
//   - standalone (default): its own Card with a title header. Kept for dev
//     galleries and any direct use.
//   - embedded: renders only the action area (no Card, no title), compact, so
//     PropertyChainCard can slot it into a chain-spine node. When a tracker is
//     active, the step list collapses behind a "Reported X/Y" summary.
//
// Everything is labelled "reported" and never leaves our side.
// Spec: docs/active/onward-visibility/00-discovery.md + docs/active/related-sale/00-spec.md.

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import {
  openOnwardTrackerAction,
  setOnwardTypeFactsAction,
  confirmOnwardStepAction,
  undoOnwardStepAction,
  openRelatedSaleAction,
  setRelatedSaleTypeFactsAction,
  confirmRelatedSaleStepAction,
  undoRelatedSaleStepAction,
  openOnwardSellerAction,
  setOnwardSellerTypeFactsAction,
  confirmOnwardSellerStepAction,
  undoOnwardSellerStepAction,
  openRelatedBuyerAction,
  setRelatedBuyerTypeFactsAction,
  confirmRelatedBuyerStepAction,
  undoRelatedBuyerStepAction,
  setOnwardRelatedAddressAction,
} from "@/app/actions/onward";
import type { OnwardTrackerKind } from "@prisma/client";
import type {
  OnwardTrackerView,
  OnwardStepView,
  ConfirmOnwardResult,
  UndoOnwardResult,
} from "@/lib/services/onward";
import { DateField } from "@/components/ui/DateField";
import { ChaseNeighbourDrawer } from "@/components/chase/ChaseNeighbourDrawer";
import type { NeighbourChaseDirection } from "@/lib/services/neighbour-chase";
import { getEventDateLabel } from "@/lib/portal-copy";
import { VENDOR_SECTIONS, PURCHASER_SECTIONS } from "@/lib/milestone-sections";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";
// near sides: "onward" (our seller buying) / "related" (our buyer selling).
// far sides (agent-only): "onward_seller" (the onward property's seller) /
// "related_buyer" (the related sale's buyer).
type Direction = "onward" | "related" | "onward_seller" | "related_buyer";

const SECONDARY = "var(--agent-text-secondary)";
const MUTED = "var(--agent-text-muted, var(--agent-text-secondary))";

// Read-only due countdown ("fuse") for an actionable step. The grace period fills
// the bar as it elapses, ramping calm blue → amber → red, then reads "Due" once
// the deadline passes. Ticks each minute client-side; suppressHydrationWarning
// because the value is time-relative (server HTML and first client paint can
// differ by seconds). Nothing is scheduled off this — purely a glance signal.
function DueFuse({ startedAt, dueAt }: { startedAt: string; dueAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const start = Date.parse(startedAt);
  const due = Date.parse(dueAt);
  const total = Math.max(1, due - start);
  const remaining = due - now;
  const overdue = remaining <= 0;
  const pct = overdue ? 100 : Math.max(0, Math.min(100, ((now - start) / total) * 100));
  const remH = remaining / 3_600_000;

  const tone = overdue ? "due" : remH < 6 ? "red" : remH < 48 ? "amber" : "calm";
  const fill =
    tone === "due" || tone === "red" ? "#DC2626"
    : tone === "amber" ? "var(--agent-warning, #D59929)"
    : "var(--agent-info, #3E63E8)";
  const lblColor =
    tone === "due" ? "var(--agent-coral-deep, #E8542F)"
    : tone === "red" ? "#DC2626"
    : tone === "amber" ? "var(--agent-warning, #D59929)"
    : "var(--agent-info, #3E63E8)";

  let label: string;
  if (overdue) {
    label = "Due";
  } else {
    const d = Math.floor(remH / 24);
    const h = Math.round(remH % 24);
    if (d >= 1) label = h > 0 ? `Due in ${d}d ${h}h` : `Due in ${d}d`;
    else if (remH >= 1) label = `Due in ${Math.round(remH)}h`;
    else label = "Due within the hour";
  }

  return (
    <div style={{ marginTop: 6, maxWidth: 240 }} suppressHydrationWarning>
      <div style={{ height: 5, borderRadius: 3, background: "var(--agent-surface-nested, rgba(15,23,42,0.06))", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${pct}%`, background: fill, borderRadius: 3, transition: "width .3s ease, background .3s ease" }} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 650, marginTop: 3, color: lblColor, fontVariantNumeric: "tabular-nums" }}>
        {label}
      </div>
    </div>
  );
}

function tenureLabel(t: Tenure | null) {
  return t === "leasehold" ? "Leasehold" : t === "freehold" ? "Freehold" : "";
}
function purchaseLabel(p: PurchaseType | null) {
  return p === "mortgage" ? "Mortgage" : p === "cash_buyer" ? "Cash" : p === "cash_from_proceeds" ? "Cash from proceeds" : "";
}

function ukDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type StepRowPayload = {
  eventDate: string | null;
  keyCollectionRequired: boolean | null;
  bookedSurveyorName: string | null;
};

// One reported step. Each row owns its OWN pending state, so confirming one never
// disables the others — an agent can rip straight down a backlog. The primary
// button stays pinned top-right and is REUSED: first tap arms an inline form,
// second tap on the same spot commits (Cancel sits to its left so a fast
// double-tap can't land on it). Optimistic: the row flips to done instantly.
// Mirrors the main-sale MilestoneRow. Date labels come from getEventDateLabel;
// the desktop-valuation / keys / surveyor extras match the main sale, with keys +
// surveyor shown only when the linked sale is the agency's own file.
function OnwardStepRow({
  step,
  isFarSide,
  isOwnAgencyFile,
  waitingLabel,
  onConfirm,
  onUndo,
  onChase,
}: {
  step: OnwardStepView;
  isFarSide: boolean;
  isOwnAgencyFile: boolean;
  waitingLabel: string;
  onConfirm: (code: string, payload: StepRowPayload) => Promise<boolean>;
  onUndo: (code: string) => Promise<boolean>;
  onChase: (code: string, name: string) => void;
}) {
  const [armed, setArmed] = useState(false);
  const [date, setDate] = useState("");
  const [desktop, setDesktop] = useState(false);
  const [keys, setKeys] = useState(false);
  const [surveyor, setSurveyor] = useState("");
  const [pending, setPending] = useState(false);
  const [optimisticDone, setOptimisticDone] = useState(false);

  const isPM6 = step.code === "PM6"; // lender valuation
  const isPM9 = step.code === "PM9"; // book survey
  const canKeys = isOwnAgencyFile && (isPM6 || isPM9);
  const canSurveyor = isOwnAgencyFile && isPM9;
  const done = step.isComplete || optimisticDone;
  const desktopChosen = isPM6 && desktop;
  const dateLabel = step.eventDateRequired ? getEventDateLabel(step.code) : "Date this happened";
  const dateRequired = step.eventDateRequired && !desktopChosen;
  const canSave = !pending && (!dateRequired || !!date);

  function arm() {
    setArmed(true);
    // Optional-date steps pre-fill today so it's still a same-spot double-tap;
    // required-date steps open blank so the agent must enter the real date.
    setDate(step.eventDateRequired ? "" : new Date().toISOString().slice(0, 10));
    setDesktop(false); setKeys(false); setSurveyor("");
  }
  async function commit() {
    if (!canSave) return;
    setPending(true); setOptimisticDone(true);
    const ok = await onConfirm(step.code, {
      eventDate: desktopChosen ? null : (date || null),
      keyCollectionRequired: canKeys && !desktopChosen ? keys : null,
      bookedSurveyorName: canSurveyor ? (surveyor.trim() || null) : null,
    });
    setPending(false);
    if (!ok) setOptimisticDone(false); else setArmed(false);
  }
  async function undo() {
    setPending(true);
    const ok = await onUndo(step.code);
    setPending(false);
    if (ok) setOptimisticDone(false);
  }

  let completedSub = "";
  if (step.isComplete) {
    const who = step.confirmedByName ? ` by ${step.confirmedByName}` : "";
    const when = isPM6 && !step.eventDate ? " · Desktop valuation" : step.eventDate ? ` · ${ukDate(step.eventDate)}` : " · date not given";
    const firm = step.bookedSurveyorName ? ` · Booked with ${step.bookedSurveyorName}` : "";
    const k = step.keyCollectionRequired ? " · Keys from us" : "";
    completedSub = `Reported${who}${when}${firm}${k}`;
  }

  return (
    <li style={{ padding: "8px 8px", borderTop: "1px solid var(--agent-border, rgba(0,0,0,0.06))" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: done || step.isAvailable ? "var(--agent-text-primary, #111)" : MUTED, fontWeight: done ? 500 : 400 }}>
            {step.name}
          </div>
          {done ? (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{step.isComplete ? completedSub : "Reported · saving…"}</div>
          ) : !step.isAvailable ? (
            <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Waiting on {waitingLabel}</div>
          ) : !armed && step.dueTimer ? (
            <DueFuse startedAt={step.dueTimer.startedAt} dueAt={step.dueTimer.dueAt} />
          ) : null}
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          {done ? (
            <Button variant="ghost" size="xs" loading={pending} onClick={undo}>Undo</Button>
          ) : step.isAvailable ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {armed && (
                  <button type="button" onClick={() => setArmed(false)} className="agent-link"
                    style={{ fontSize: 11, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: MUTED }}>
                    Cancel
                  </button>
                )}
                <Button variant={armed ? "primary" : "secondary"} size="xs" loading={pending}
                  disabled={armed ? !canSave : false} onClick={armed ? commit : arm}>
                  {armed ? "Save reported" : "Confirm"}
                </Button>
              </div>
              {!armed && isFarSide && (
                <button type="button" onClick={() => onChase(step.code, step.name)} className="agent-link"
                  style={{ fontSize: 11, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: SECONDARY }}>
                  Chase agent
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {armed && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
          {!desktopChosen && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <label style={{ fontSize: 11, color: MUTED }}>{dateLabel}</label>
              <DateField
                value={date}
                onChange={(e) => setDate(e.target.value)}
                wrapperStyle={{ display: "inline-block" }}
                style={{ fontSize: 12, padding: "3px 6px", border: "1px solid var(--agent-border, rgba(0,0,0,0.15))", borderRadius: 6 }}
              />
            </div>
          )}
          {isPM6 && (
            <label style={{ fontSize: 12, color: SECONDARY, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={desktop} onChange={(e) => { setDesktop(e.target.checked); if (e.target.checked) { setDate(""); setKeys(false); } }} />
              Desktop valuation, no date
            </label>
          )}
          {canKeys && !desktopChosen && (
            <label style={{ fontSize: 12, color: SECONDARY, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={keys} onChange={(e) => setKeys(e.target.checked)} />
              {isPM9 ? "Surveyor collects keys from us" : "Valuer collects keys from us"}
            </label>
          )}
          {canSurveyor && (
            <input
              type="text"
              value={surveyor}
              onChange={(e) => setSurveyor(e.target.value)}
              placeholder="Surveyor firm (optional)"
              style={{ fontSize: 12, padding: "4px 8px", border: "1px solid var(--agent-border, rgba(0,0,0,0.15))", borderRadius: 6, maxWidth: 260 }}
            />
          )}
        </div>
      )}
    </li>
  );
}

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  gap: 8,
};
const titleStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: SECONDARY, margin: 0 };
const errStyle: React.CSSProperties = { color: "var(--agent-danger, #c0392b)", fontSize: 12, marginTop: 8 };

// Section header tints — mirror the main-sale Steps tab palette (MilestonePanel
// SECTION_COLORS) so the grouping reads the same on onward/related trackers.
const SECTION_TINT: Record<string, string> = {
  "Onboarding": "#60a5fa",
  "Finances": "#a78bfa",
  "Surveys": "#38bdf8",
  "Conveyancing": "#f59e0b",
  "Exchange & Completion": "#10b981",
};

export function OnwardPurchaseCard({
  transactionId,
  initialView,
  signalActive = false,
  onwardAddress = null,
  direction = "onward",
  embedded = false,
  seedTenure = null,
  seedShareOfFreehold = false,
  defaultStepsOpen = false,
}: {
  transactionId: string;
  initialView: OnwardTrackerView;
  signalActive?: boolean;
  onwardAddress?: string | null;
  direction?: Direction;
  // When true, drops the Card + title and renders a compact action area for the
  // chain spine (PropertyChainCard). The step list collapses by default.
  embedded?: boolean;
  // Far sides: pre-fill the type-facts form from the near sibling (same
  // property) so the agent never re-enters tenure. Only used when this tracker
  // has no tenure of its own yet.
  seedTenure?: Tenure | null;
  seedShareOfFreehold?: boolean;
  // When embedded inside the chain card's focus panel the link is already
  // selected, so the step list opens straight away instead of behind a
  // "View steps" tap.
  defaultStepsOpen?: boolean;
}) {
  // Purchaser-side directions carry a buying axis (purchaseType); vendor-side
  // don't. onward + related_buyer = purchaser (PM); related + onward_seller = vendor (VM).
  const isPurchaserSide = direction === "onward" || direction === "related_buyer";
  const needsPurchaseType = isPurchaserSide;
  const gateCode = isPurchaserSide ? "PM25" : "VM18";
  const sectionId = `chain-${direction}-section`;

  type SetFactsInput = { transactionId: string; tenure: Tenure; purchaseType: PurchaseType; isShareOfFreehold: boolean };
  type ConfirmInput = { transactionId: string; milestoneCode: string; eventDate?: string | null };
  type UndoInput = { transactionId: string; milestoneCode: string };
  type ActionSet = {
    open: (txId: string) => Promise<OnwardTrackerView>;
    confirm: (i: ConfirmInput) => Promise<{ result: ConfirmOnwardResult; view: OnwardTrackerView }>;
    undo: (i: UndoInput) => Promise<{ result: UndoOnwardResult; view: OnwardTrackerView }>;
    setFacts: (i: SetFactsInput) => Promise<OnwardTrackerView>;
  };
  const ACTIONS: Record<Direction, ActionSet> = {
    onward: { open: openOnwardTrackerAction, confirm: confirmOnwardStepAction, undo: undoOnwardStepAction, setFacts: setOnwardTypeFactsAction },
    related: {
      open: openRelatedSaleAction, confirm: confirmRelatedSaleStepAction, undo: undoRelatedSaleStepAction,
      setFacts: (i) => setRelatedSaleTypeFactsAction({ transactionId: i.transactionId, tenure: i.tenure, isShareOfFreehold: i.isShareOfFreehold }),
    },
    onward_seller: {
      open: openOnwardSellerAction, confirm: confirmOnwardSellerStepAction, undo: undoOnwardSellerStepAction,
      setFacts: (i) => setOnwardSellerTypeFactsAction({ transactionId: i.transactionId, tenure: i.tenure, isShareOfFreehold: i.isShareOfFreehold }),
    },
    related_buyer: { open: openRelatedBuyerAction, confirm: confirmRelatedBuyerStepAction, undo: undoRelatedBuyerStepAction, setFacts: setRelatedBuyerTypeFactsAction },
  };
  const actions = ACTIONS[direction];
  const trackerKind: OnwardTrackerKind =
    direction === "onward" ? "onward_purchase"
      : direction === "related" ? "related_sale"
        : direction === "onward_seller" ? "onward_purchase_seller"
          : "related_sale_buyer";

  type CardCopy = {
    title: string; supersededTag: string; supersededBody: string; abandonedTag: string; abandonedBody: string;
    signalPrompt: string; passivePrompt: string; setupCta: string; factsPrompt: string; reportedBy: string;
  };
  const TXT: Record<Direction, CardCopy> = {
    onward: {
      title: "Onward purchase",
      supersededTag: "Handled up the chain",
      supersededBody: "The agent progressing the property this seller is buying now owns these updates, so the reported tracker here is read-only.",
      abandonedTag: "Not going ahead",
      abandonedBody: "This seller's onward purchase is no longer going ahead.",
      signalPrompt: `This seller is buying onward${onwardAddress ? ` (${onwardAddress})` : ""}. Set up tracking so you and they can see where their purchase is up to.`,
      passivePrompt: "If this seller is buying onward, track where their purchase is up to. Reported progress stays on this file and is not shared with other agencies.",
      setupCta: "Set up onward tracking",
      factsPrompt: "Tell us the onward property type and how they are buying, so we show the right steps.",
      reportedBy: "As reported by the seller. Not confirmed by the onward agent.",
    },
    related: {
      title: "Related sale",
      supersededTag: "Handled down the chain",
      supersededBody: "The agent progressing the property this buyer is selling now owns these updates, so the reported tracker here is read-only.",
      abandonedTag: "Not going ahead",
      abandonedBody: "This buyer's related sale is no longer going ahead.",
      signalPrompt: `This buyer is also selling${onwardAddress ? ` (${onwardAddress})` : ""}. Set up tracking so you and they can see where their sale is up to.`,
      passivePrompt: "If this buyer is also selling a property, track where their sale is up to. Reported progress stays on this file and is not shared with other agencies.",
      setupCta: "Set up sale tracking",
      factsPrompt: "Tell us the type of the property they're selling, so we show the right steps.",
      reportedBy: "As reported by the buyer. Not confirmed by the sale's agent.",
    },
    // FAR side of the onward purchase: the seller of the property our seller is
    // buying. Agent-only — you record what the agent up the chain tells you.
    onward_seller: {
      title: "Onward · seller's side",
      supersededTag: "Handled up the chain",
      supersededBody: "The agent progressing this property now owns these updates, so the reported tracker here is read-only.",
      abandonedTag: "Not going ahead",
      abandonedBody: "This onward purchase is no longer going ahead.",
      signalPrompt: "Track the seller's side of the onward property too, from what the agent up the chain tells you.",
      passivePrompt: "Track the seller's side of the onward property, from what the agent up the chain tells you. Agent-only, and never shared with other agencies.",
      setupCta: "Set up the seller's side",
      factsPrompt: "Confirm the property type, so we show the right steps.",
      reportedBy: "As recorded by your team from the agent up the chain. Not confirmed by that agent.",
    },
    // FAR side of the related sale: the buyer of the home our buyer is selling.
    related_buyer: {
      title: "Related · buyer's side",
      supersededTag: "Handled down the chain",
      supersededBody: "The agent progressing this property now owns these updates, so the reported tracker here is read-only.",
      abandonedTag: "Not going ahead",
      abandonedBody: "This related sale is no longer going ahead.",
      signalPrompt: "Track the buyer's side of the related sale too, from what the agent down the chain tells you.",
      passivePrompt: "Track the buyer's side of the related sale, from what the agent down the chain tells you. Agent-only, and never shared with other agencies.",
      setupCta: "Set up the buyer's side",
      factsPrompt: "Confirm the property type and how the buyer is buying, so we show the right steps.",
      reportedBy: "As recorded by your team from the agent down the chain. Not confirmed by that agent.",
    },
  };
  const txt = TXT[direction];

  // The name of the first unmet prerequisite, resolved from the visible steps.
  function blockingLabel(step: OnwardStepView, steps: OnwardStepView[]): string {
    if (step.code === gateCode) return "the steps above";
    const prereqs = DIRECT_PREREQUISITES[step.code] ?? [];
    const nameByCode = new Map(steps.map((s) => [s.code, s]));
    for (const p of prereqs) {
      const s = nameByCode.get(p);
      if (s && !s.isComplete) return s.name.toLowerCase();
    }
    return "an earlier step";
  }

  const [view, setView] = useState<OnwardTrackerView>(initialView);
  // Manual pending flag (not useTransition): the onward actions call
  // revalidateTx, which re-renders the heavy Overview panel. A transition would
  // stay pending until that whole re-render settled — the spinner would hang
  // for seconds and the deferred commit would appear to wipe in-progress picks.
  // The card already updates from the value each action returns (setView), so
  // the spinner should end the moment the write resolves; the revalidate then
  // refreshes the rest of the page in the background.
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A+B: the related/onward property's address. Prefills from the tracker if set,
  // else from the chain-derived address prop. When saved, mail naming it auto-files.
  const [address, setAddress] = useState<string>(view.relatedPropertyAddress ?? onwardAddress ?? "");

  // Phase 5 follow-up (2026-09-18, perceived performance): optimistic
  // availability overlay. Confirming a step used to leave its dependents
  // locked until the action's response resolved - and that response also
  // carries the revalidated file page, so on these trackers "the next step
  // takes ages to open" even though the row itself flips instantly. The
  // overlay mirrors the server's availability rule (see
  // computeOnwardStepAvailability in lib/services/onward.ts): a non-gate
  // step is available once every DIRECT_PREREQUISITES code is satisfied,
  // where satisfied = not tracked in this view (other side / auto-NR) or
  // complete. The exchange gate is deliberately NOT unlocked optimistically
  // (its rule needs blocksExchange data the view doesn't carry) - it opens
  // on canonical reconcile exactly as before. setView(next) stays the
  // source of truth: the overlay only ever OPENS steps early, is pruned
  // against every canonical view, and is reverted per-code on failure.
  const [optCompletedCodes, setOptCompletedCodes] = useState<Set<string>>(new Set());
  const [optUnlockedCodes, setOptUnlockedCodes] = useState<Set<string>>(new Set());

  function dependentsUnlockedBy(code: string, v: OnwardTrackerView): string[] {
    const byCode = new Map(v.steps.map((s) => [s.code, s]));
    const completed = (c: string) =>
      c === code || optCompletedCodes.has(c) || (byCode.get(c)?.isComplete ?? false);
    const satisfied = (c: string) => !byCode.has(c) || completed(c);
    const out: string[] = [];
    for (const st of v.steps) {
      if (st.isComplete || st.isAvailable || st.code === gateCode) continue;
      const prereqs = DIRECT_PREREQUISITES[st.code] ?? [];
      if (prereqs.includes(code) && prereqs.every(satisfied)) out.push(st.code);
    }
    return out;
  }

  // Drop overlay entries the canonical view now agrees with (it carries
  // them itself); keep entries canonical still disputes - those belong to
  // other in-flight confirms and reconcile when THEIR view arrives.
  function pruneOverlay(next: OnwardTrackerView) {
    setOptCompletedCodes((prev) => {
      const n = new Set([...prev].filter((c) => {
        const st = next.steps.find((x) => x.code === c);
        return st ? !st.isComplete : false;
      }));
      return n.size === prev.size ? prev : n;
    });
    setOptUnlockedCodes((prev) => {
      const n = new Set([...prev].filter((c) => {
        const st = next.steps.find((x) => x.code === c);
        return st ? !(st.isAvailable || st.isComplete) : false;
      }));
      return n.size === prev.size ? prev : n;
    });
  }

  // Type-facts form state (used when not yet set / editing). Far sides pre-fill
  // tenure from the near sibling (same property) when they have none of their own.
  const [editingFacts, setEditingFacts] = useState(false);
  const [tenure, setTenure] = useState<Tenure | null>(initialView.tenure ?? seedTenure);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(initialView.purchaseType);
  const [shareOfFreehold, setShareOfFreehold] = useState(
    initialView.tenure != null ? initialView.isShareOfFreehold : seedShareOfFreehold,
  );

  // Embedded step list starts collapsed behind the "Reported X/Y" summary,
  // unless the chain focus panel opens it straight away.
  const [stepsOpen, setStepsOpen] = useState(defaultStepsOpen);

  // Far sides (agent records the neighbour's side) can chase that neighbour agent
  // for an update — the inbound twin of the far-side tracker. Never on near sides
  // (those are our own client's reported progress).
  const isFarSide = direction === "onward_seller" || direction === "related_buyer";
  const chaseDir: NeighbourChaseDirection = direction === "onward_seller" ? "onward" : "related";
  // Per-step chase: the far-side step we're chasing the neighbour agent about.
  const [chaseStep, setChaseStep] = useState<{ code: string; name: string } | null>(null);

  function run(fn: () => Promise<OnwardTrackerView>) {
    setError(null);
    setPending(true);
    (async () => {
      try {
        const next = await fn();
        setView(next);
      } catch {
        setError("Something went wrong. Try again.");
      } finally {
        setPending(false);
      }
    })();
  }

  // Per-step confirm/undo — NOT via run(), so each row's own spinner covers only
  // itself and the list never locks. Each returns success so the row can keep or
  // revert its optimistic "done" state; the fresh view keeps counts + unlocks in
  // sync. errors surface at the card level.
  async function confirmStepRow(code: string, payload: StepRowPayload): Promise<boolean> {
    setError(null);
    // Optimistic: count the step and open its deterministic dependents NOW -
    // the canonical view reconciles (or reverts) when the action resolves.
    const unlocked = dependentsUnlockedBy(code, view);
    setOptCompletedCodes((p) => new Set(p).add(code));
    if (unlocked.length > 0) setOptUnlockedCodes((p) => new Set([...p, ...unlocked]));
    const revert = () => {
      setOptCompletedCodes((p) => { const n = new Set(p); n.delete(code); return n; });
      if (unlocked.length > 0) setOptUnlockedCodes((p) => { const n = new Set(p); for (const c of unlocked) n.delete(c); return n; });
    };
    try {
      const { result, view: next } = await actions.confirm({ transactionId, milestoneCode: code, ...payload });
      if (result.ok === false) {
        revert();
        setError(
          result.reason === "locked" ? "Confirm the earlier step first."
          : result.reason === "awaiting_our_completion" ? "The onward can't complete until this sale completes."
          : "Could not report this step.",
        );
        return false;
      }
      setView(next);
      pruneOverlay(next);
      return true;
    } catch {
      revert();
      setError("Something went wrong. Try again.");
      return false;
    }
  }
  async function undoStepRow(code: string): Promise<boolean> {
    setError(null);
    try {
      const { result, view: next } = await actions.undo({ transactionId, milestoneCode: code });
      if (result.ok === false) {
        setError(result.reason === "has_dependents" ? "Undo the later reported step first." : "Couldn't undo this step.");
        return false;
      }
      setView(next);
      pruneOverlay(next);
      return true;
    } catch {
      setError("Something went wrong. Try again.");
      return false;
    }
  }

  // Wrap a state's body in the right shell: bare div when embedded (the spine
  // supplies the title + padding), the full Card + title header otherwise.
  function shell(body: React.ReactNode, tag?: React.ReactNode) {
    if (embedded) return <div style={{ padding: "0 4px" }}>{body}</div>;
    return (
      <Card id={sectionId} padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>{txt.title}</h3>
          {tag && <span style={{ fontSize: 11, color: MUTED }}>{tag}</span>}
        </div>
        <div style={{ padding: "0 16px 14px" }}>{body}</div>
      </Card>
    );
  }

  // ── Superseded / abandoned: read-only status text ────────────────────────────
  if (view.exists && view.status === "superseded") {
    return shell(<p style={{ margin: 0, fontSize: 13, color: MUTED }}>{txt.supersededBody}</p>, txt.supersededTag);
  }
  if (view.exists && view.status === "abandoned") {
    return shell(<p style={{ margin: 0, fontSize: 13, color: MUTED }}>{txt.abandonedBody}</p>, txt.abandonedTag);
  }

  // ── Not opened yet ─────────────────────────────────────────────────────────
  if (!view.exists) {
    const cta = (
      <>
        <Button
          variant={signalActive ? "primary" : "secondary"}
          size="sm"
          loading={pending}
          onClick={() => run(() => actions.open(transactionId))}
        >
          {txt.setupCta}
        </Button>
        {error && <p style={errStyle}>{error}</p>}
      </>
    );
    // Embedded: the spine node header already carries the address, so we skip
    // the long prompt and show just the CTA (a short hint only when passive).
    if (embedded) {
      return (
        <div style={{ padding: "0 4px" }}>
          {!signalActive && (
            <p style={{ margin: "0 0 8px", fontSize: 12, color: MUTED }}>Not confirmed yet. Set up tracking if they are.</p>
          )}
          {cta}
        </div>
      );
    }
    return shell(
      <>
        {signalActive ? (
          <p style={{ margin: "0 0 10px", color: "var(--agent-text-primary, #111)" }}>{txt.signalPrompt}</p>
        ) : (
          <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED }}>{txt.passivePrompt}</p>
        )}
        {cta}
      </>,
    );
  }

  // ── Type-facts form (not set, or editing) ─────────────────────────────────
  const showFactsForm = !view.typeFactsSet || editingFacts;
  if (showFactsForm) {
    const canSave = tenure !== null && (!needsPurchaseType || purchaseType !== null) && !pending;
    const factsForm = (
      <>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: MUTED }}>{txt.factsPrompt}</p>

        <FactRow label="Property type">
          <Pill on={tenure === "freehold"} onClick={() => { setTenure("freehold"); setShareOfFreehold(false); }}>Freehold</Pill>
          <Pill on={tenure === "leasehold"} onClick={() => setTenure("leasehold")}>Leasehold</Pill>
        </FactRow>

        {tenure === "leasehold" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 10px", fontSize: 12 }}>
            <input type="checkbox" checked={shareOfFreehold} onChange={(e) => setShareOfFreehold(e.target.checked)} />
            Share of freehold
          </label>
        )}

        {needsPurchaseType && (
          <FactRow label="Buying with">
            <Pill on={purchaseType === "mortgage"} onClick={() => setPurchaseType("mortgage")}>Mortgage</Pill>
            <Pill on={purchaseType === "cash_buyer"} onClick={() => setPurchaseType("cash_buyer")}>Cash</Pill>
            <Pill on={purchaseType === "cash_from_proceeds"} onClick={() => setPurchaseType("cash_from_proceeds")}>Cash from proceeds</Pill>
          </FactRow>
        )}

        <div style={{ margin: "2px 0 12px" }}>
          <label style={{ display: "block", fontSize: 12, color: MUTED, marginBottom: 4 }}>
            Property address <span style={{ opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 25 Austin House, Harlow, CM20 2UA"
            style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 13, borderRadius: 8, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated, #fff)", color: "var(--agent-text-primary)" }}
          />
          <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
            Emails naming this property will file onto this sale automatically.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!canSave}
            onClick={() =>
              run(async () => {
                await actions.setFacts({
                  transactionId,
                  tenure: tenure as Tenure,
                  purchaseType: purchaseType as PurchaseType,
                  isShareOfFreehold: shareOfFreehold,
                });
                const next = await setOnwardRelatedAddressAction({
                  transactionId,
                  kind: trackerKind,
                  address: address.trim() || null,
                });
                setEditingFacts(false);
                return next;
              })
            }
          >
            Save
          </Button>
          {view.typeFactsSet && (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditingFacts(false)}>
              Cancel
            </Button>
          )}
        </div>
        {error && <p style={errStyle}>{error}</p>}
      </>
    );
    return shell(factsForm, "Reported");
  }

  // ── Step list ──────────────────────────────────────────────────────────────
  const factsSummary = [
    tenureLabel(view.tenure),
    view.isShareOfFreehold ? "(share of freehold)" : "",
    needsPurchaseType ? purchaseLabel(view.purchaseType) : "",
  ]
    .filter(Boolean)
    .join(" ");

  const editTypeBtn = (
    <button
      type="button"
      onClick={() => { setEditingFacts(true); setTenure(view.tenure); setPurchaseType(view.purchaseType); setShareOfFreehold(view.isShareOfFreehold); }}
      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: SECONDARY, textDecoration: "underline" }}
    >
      Edit type
    </button>
  );

  // Reported-count display includes in-flight optimistic completes so the
  // summary chip moves with the click (the canonical view replaces it at ack).
  const optExtraCompletes = [...optCompletedCodes].filter((c) => {
    const st = view.steps.find((x) => x.code === c);
    return st ? !st.isComplete : false;
  }).length;
  const shownCompleteCount = view.completeCount + optExtraCompletes;

  // Group the steps into the SAME named sections as the main-sale Steps tab, in
  // the same curated order (milestone-sections.ts) — so an onward/related tracker
  // reads identically (Finances before Conveyancing, PM11 before the survey,
  // VM21 after VM10) instead of a flat numeric run. Reuses the one canonical
  // grouping, so it can't drift from the main sale.
  const sectionDefs = isPurchaserSide ? PURCHASER_SECTIONS : VENDOR_SECTIONS;
  const stepByCode = new Map(view.steps.map((s) => [s.code, s]));
  const grouped = sectionDefs
    .map((sec) => ({
      label: sec.label,
      steps: sec.codes.map((c) => stepByCode.get(c)).filter((s): s is OnwardStepView => s != null),
    }))
    .filter((g) => g.steps.length > 0);
  // Safety net: never silently drop a confirmable step that isn't in a section.
  const grouped_codes = new Set(grouped.flatMap((g) => g.steps.map((s) => s.code)));
  const leftover = view.steps.filter((s) => !grouped_codes.has(s.code));

  function renderRows(steps: OnwardStepView[]) {
    return (
      <ul style={{ listStyle: "none", margin: 0, padding: "0 8px 6px" }}>
        {steps.map((rawStep) => {
          // Overlay: a step whose prerequisites were just optimistically
          // completed renders as available immediately.
          const step = !rawStep.isAvailable && optUnlockedCodes.has(rawStep.code)
            ? { ...rawStep, isAvailable: true }
            : rawStep;
          return (
          <OnwardStepRow
            key={step.code}
            step={step}
            isFarSide={isFarSide}
            isOwnAgencyFile={view.isOwnAgencyFile}
            waitingLabel={blockingLabel(step, view.steps)}
            onConfirm={confirmStepRow}
            onUndo={undoStepRow}
            onChase={(code, name) => setChaseStep({ code, name })}
          />
          );
        })}
      </ul>
    );
  }

  function sectionHeader(label: string) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 10px 3px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: SECTION_TINT[label] ?? MUTED }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: SECONDARY }}>{label}</span>
      </div>
    );
  }

  const stepList = (
    <div style={{ paddingBottom: 6 }}>
      {grouped.map((g) => (
        <div key={g.label}>
          {sectionHeader(g.label)}
          {renderRows(g.steps)}
        </div>
      ))}
      {leftover.length > 0 && (
        <div>
          {sectionHeader("Other steps")}
          {renderRows(leftover)}
        </div>
      )}
    </div>
  );

  // "Chase the neighbour agent" — far sides only, now per-step (the link sits on
  // each unlocked-but-incomplete step in the list above). The drawer resolves the
  // stub agent above/below server-side and drafts the ask about the chosen step.
  const chaseDrawer = chaseStep ? (
    <ChaseNeighbourDrawer
      transactionId={transactionId}
      direction={chaseDir}
      neighbourAddress={onwardAddress}
      targetStepName={chaseStep.name}
      onClose={() => setChaseStep(null)}
    />
  ) : null;

  // Embedded: a compact "Reported X/Y" summary with a slim progress bar; the
  // step list expands on demand so the spine stays tight.
  if (embedded) {
    const pct = view.applicableCount > 0 ? Math.round((shownCompleteCount / view.applicableCount) * 100) : 0;
    return (
      <div style={{ padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: SECONDARY, fontVariantNumeric: "tabular-nums" }}>
            Reported {shownCompleteCount}/{view.applicableCount}
          </span>
          <span style={{ width: 96, height: 6, borderRadius: 99, background: "var(--agent-border, rgba(0,0,0,0.10))", overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", borderRadius: 99, width: `${pct}%`, background: "var(--agent-coral, #FF6B4A)" }} />
          </span>
          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            style={{ marginLeft: "auto", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--agent-blue, #3E63E8)" }}
          >
            {stepsOpen ? "Hide steps" : "View steps"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{factsSummary}</span>
          {editTypeBtn}
        </div>
        {stepsOpen && (
          <>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED }}>{txt.reportedBy}</p>
            {stepList}
            {chaseDrawer}
          </>
        )}
        {error && <p style={errStyle}>{error}</p>}
      </div>
    );
  }

  return (
    <Card id={sectionId} padding="none">
      <div style={cardHeaderStyle}>
        <h3 style={titleStyle}>{txt.title}</h3>
        <span style={{ fontSize: 11, color: MUTED }}>
          Reported · {shownCompleteCount}/{view.applicableCount}
        </span>
      </div>

      <div style={{ padding: "0 16px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: MUTED }}>{factsSummary}</span>
        {editTypeBtn}
      </div>

      <p style={{ padding: "0 16px 8px", margin: 0, fontSize: 11, color: MUTED }}>{txt.reportedBy}</p>

      {stepList}

      {chaseDrawer}

      {error && <p style={{ padding: "0 16px 12px", margin: 0, color: "var(--agent-danger, #c0392b)", fontSize: 12 }}>{error}</p>}
    </Card>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "0 0 10px" }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: "5px 10px",
        borderRadius: 999,
        cursor: "pointer",
        border: on ? "1px solid #FF6B4A" : "1px solid var(--agent-border, rgba(0,0,0,0.15))",
        background: on ? "rgba(255,107,74,0.10)" : "transparent",
        color: on ? "#FF6B4A" : "var(--agent-text-primary, #333)",
        fontWeight: on ? 600 : 400,
      }}
    >
      {children}
    </button>
  );
}
