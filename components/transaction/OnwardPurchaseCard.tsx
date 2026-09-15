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

import { useState, useTransition } from "react";
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
} from "@/app/actions/onward";
import type {
  OnwardTrackerView,
  OnwardStepView,
  ConfirmOnwardResult,
  UndoOnwardResult,
} from "@/lib/services/onward";
import { DateField } from "@/components/ui/DateField";
import { ChaseNeighbourDrawer } from "@/components/chase/ChaseNeighbourDrawer";
import type { NeighbourChaseDirection } from "@/lib/services/neighbour-chase";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";
// near sides: "onward" (our seller buying) / "related" (our buyer selling).
// far sides (agent-only): "onward_seller" (the onward property's seller) /
// "related_buyer" (the related sale's buyer).
type Direction = "onward" | "related" | "onward_seller" | "related_buyer";

const SECONDARY = "var(--agent-text-secondary)";
const MUTED = "var(--agent-text-muted, var(--agent-text-secondary))";

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

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  gap: 8,
};
const titleStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: SECONDARY, margin: 0 };
const errStyle: React.CSSProperties = { color: "var(--agent-danger, #c0392b)", fontSize: 12, marginTop: 8 };

export function OnwardPurchaseCard({
  transactionId,
  initialView,
  signalActive = false,
  onwardAddress = null,
  direction = "onward",
  embedded = false,
  seedTenure = null,
  seedShareOfFreehold = false,
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Type-facts form state (used when not yet set / editing). Far sides pre-fill
  // tenure from the near sibling (same property) when they have none of their own.
  const [editingFacts, setEditingFacts] = useState(false);
  const [tenure, setTenure] = useState<Tenure | null>(initialView.tenure ?? seedTenure);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(initialView.purchaseType);
  const [shareOfFreehold, setShareOfFreehold] = useState(
    initialView.tenure != null ? initialView.isShareOfFreehold : seedShareOfFreehold,
  );

  // Per-step confirm bar state.
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState("");

  // Embedded step list starts collapsed behind the "Reported X/Y" summary.
  const [stepsOpen, setStepsOpen] = useState(false);

  // Far sides (agent records the neighbour's side) can chase that neighbour agent
  // for an update — the inbound twin of the far-side tracker. Never on near sides
  // (those are our own client's reported progress).
  const isFarSide = direction === "onward_seller" || direction === "related_buyer";
  const chaseDir: NeighbourChaseDirection = direction === "onward_seller" ? "onward" : "related";
  // Per-step chase: the far-side step we're chasing the neighbour agent about.
  const [chaseStep, setChaseStep] = useState<{ code: string; name: string } | null>(null);

  function run(fn: () => Promise<OnwardTrackerView>) {
    setError(null);
    startTransition(async () => {
      try {
        const next = await fn();
        setView(next);
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
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

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={!canSave}
            onClick={() =>
              run(async () => {
                const next = await actions.setFacts({
                  transactionId,
                  tenure: tenure as Tenure,
                  purchaseType: purchaseType as PurchaseType,
                  isShareOfFreehold: shareOfFreehold,
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

  const stepList = (
    <ul style={{ listStyle: "none", margin: 0, padding: "0 8px 10px" }}>
      {view.steps.map((step) => (
        <li key={step.code} style={{ padding: "8px 8px", borderTop: "1px solid var(--agent-border, rgba(0,0,0,0.06))" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: step.isComplete ? "var(--agent-text-primary, #111)" : step.isAvailable ? "var(--agent-text-primary, #111)" : MUTED,
                  fontWeight: step.isComplete ? 500 : 400,
                }}
              >
                {step.name}
              </div>
              {step.isComplete ? (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  Reported{step.confirmedByName ? ` by ${step.confirmedByName}` : ""}
                  {step.eventDate ? ` · ${ukDate(step.eventDate)}` : " · date not given"}
                </div>
              ) : !step.isAvailable ? (
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Waiting on {blockingLabel(step, view.steps)}</div>
              ) : null}
            </div>

            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
              {step.isComplete ? (
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const { result, view: next } = await actions.undo({ transactionId, milestoneCode: step.code });
                      if (result.ok === false && result.reason === "has_dependents") {
                        setError("Undo the later reported step first.");
                      }
                      return next;
                    })
                  }
                >
                  Undo
                </Button>
              ) : step.isAvailable && confirmingCode !== step.code ? (
                <>
                  <Button variant="secondary" size="xs" disabled={pending} onClick={() => { setConfirmingCode(step.code); setConfirmDate(""); setError(null); }}>
                    Confirm
                  </Button>
                  {/* Far side only: chase the neighbour agent about THIS step. */}
                  {isFarSide && (
                    <button
                      type="button"
                      onClick={() => setChaseStep({ code: step.code, name: step.name })}
                      className="agent-link"
                      style={{ fontSize: 11, fontWeight: 600, background: "none", border: "none", padding: 0, cursor: "pointer", color: SECONDARY }}
                    >
                      Chase agent
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {confirmingCode === step.code && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <label style={{ fontSize: 11, color: MUTED }}>
                {step.eventDateRequired ? "Date it happened" : "Date (optional)"}
              </label>
              <DateField
                value={confirmDate}
                onChange={(e) => setConfirmDate(e.target.value)}
                wrapperStyle={{ display: "inline-block" }}
                style={{ fontSize: 12, padding: "3px 6px", border: "1px solid var(--agent-border, rgba(0,0,0,0.15))", borderRadius: 6 }}
              />
              <Button
                variant="primary"
                size="xs"
                loading={pending}
                onClick={() =>
                  run(async () => {
                    const { result, view: next } = await actions.confirm({
                      transactionId,
                      milestoneCode: step.code,
                      eventDate: confirmDate || null,
                    });
                    if (result.ok === false) {
                      setError(
                        result.reason === "locked"
                          ? "Confirm the earlier step first."
                          : result.reason === "awaiting_our_completion"
                            ? "The onward can't complete until this sale completes."
                            : "Could not report this step.",
                      );
                    } else {
                      setConfirmingCode(null);
                    }
                    return next;
                  })
                }
              >
                Save reported
              </Button>
              <Button variant="ghost" size="xs" disabled={pending} onClick={() => setConfirmingCode(null)}>
                Cancel
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
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
    const pct = view.applicableCount > 0 ? Math.round((view.completeCount / view.applicableCount) * 100) : 0;
    return (
      <div style={{ padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: SECONDARY, fontVariantNumeric: "tabular-nums" }}>
            Reported {view.completeCount}/{view.applicableCount}
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
          Reported · {view.completeCount}/{view.applicableCount}
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
