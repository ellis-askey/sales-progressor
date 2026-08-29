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
// Shows on the internal file beside the property-chain card. An internal user can
// open the tracker, set the type facts, and report the steps in the same
// prerequisite order the real engine enforces. Everything is labelled "reported"
// and never leaves our side.
//
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
} from "@/app/actions/onward";
import type { OnwardTrackerView, OnwardStepView } from "@/lib/services/onward";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";
type Direction = "onward" | "related";

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

export function OnwardPurchaseCard({
  transactionId,
  initialView,
  signalActive = false,
  onwardAddress = null,
  direction = "onward",
}: {
  transactionId: string;
  initialView: OnwardTrackerView;
  signalActive?: boolean;
  onwardAddress?: string | null;
  direction?: Direction;
}) {
  const isRelated = direction === "related";
  const gateCode = isRelated ? "VM18" : "PM25";
  const sectionId = isRelated ? "related-sale-section" : "onward-section";

  const actions = isRelated
    ? {
        open: openRelatedSaleAction,
        confirm: confirmRelatedSaleStepAction,
        undo: undoRelatedSaleStepAction,
        setFacts: (i: { transactionId: string; tenure: Tenure; purchaseType: PurchaseType; isShareOfFreehold: boolean }) =>
          setRelatedSaleTypeFactsAction({ transactionId: i.transactionId, tenure: i.tenure, isShareOfFreehold: i.isShareOfFreehold }),
      }
    : {
        open: openOnwardTrackerAction,
        confirm: confirmOnwardStepAction,
        undo: undoOnwardStepAction,
        setFacts: setOnwardTypeFactsAction,
      };

  const txt = isRelated
    ? {
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
      }
    : {
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
      };

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

  // Type-facts form state (used when not yet set / editing).
  const [editingFacts, setEditingFacts] = useState(false);
  const [tenure, setTenure] = useState<Tenure | null>(initialView.tenure);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(initialView.purchaseType);
  const [shareOfFreehold, setShareOfFreehold] = useState(initialView.isShareOfFreehold);

  // Per-step confirm bar state.
  const [confirmingCode, setConfirmingCode] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState("");

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

  // ── Superseded: the tracked property is now a live file with its own agent,
  //    whose real file owns the truth. This reported stand-in is read-only. ────
  if (view.exists && view.status === "superseded") {
    return (
      <Card id={sectionId} padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>{txt.title}</h3>
          <span style={{ fontSize: 11, color: MUTED }}>{txt.supersededTag}</span>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          <p style={{ margin: 0 }}>{txt.supersededBody}</p>
        </div>
      </Card>
    );
  }

  // ── Retired (withdrawn, or the client marked it no longer happening) ─────────
  if (view.exists && view.status === "abandoned") {
    return (
      <Card id={sectionId} padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>{txt.title}</h3>
          <span style={{ fontSize: 11, color: MUTED }}>{txt.abandonedTag}</span>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          <p style={{ margin: 0 }}>{txt.abandonedBody}</p>
        </div>
      </Card>
    );
  }

  // ── Not opened yet ─────────────────────────────────────────────────────────
  if (!view.exists) {
    return (
      <Card id={sectionId} padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>{txt.title}</h3>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          {signalActive ? (
            <p style={{ margin: "0 0 10px", color: "var(--agent-text-primary, #111)" }}>{txt.signalPrompt}</p>
          ) : (
            <p style={{ margin: "0 0 10px" }}>{txt.passivePrompt}</p>
          )}
          <Button
            variant={signalActive ? "primary" : "secondary"}
            size="sm"
            loading={pending}
            onClick={() => run(() => actions.open(transactionId))}
          >
            {txt.setupCta}
          </Button>
          {error && <p style={{ color: "var(--agent-danger, #c0392b)", fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      </Card>
    );
  }

  // ── Type-facts form (not set, or editing) ─────────────────────────────────
  const showFactsForm = !view.typeFactsSet || editingFacts;
  if (showFactsForm) {
    const canSave = tenure !== null && (isRelated || purchaseType !== null) && !pending;
    return (
      <Card id={sectionId} padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>{txt.title}</h3>
          <span style={{ fontSize: 11, color: MUTED }}>Reported</span>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          <p style={{ margin: "0 0 10px" }}>{txt.factsPrompt}</p>

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

          {!isRelated && (
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
          {error && <p style={{ color: "var(--agent-danger, #c0392b)", fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      </Card>
    );
  }

  // ── Step list ──────────────────────────────────────────────────────────────
  const factsSummary = [
    tenureLabel(view.tenure),
    view.isShareOfFreehold ? "(share of freehold)" : "",
    isRelated ? "" : purchaseLabel(view.purchaseType),
  ]
    .filter(Boolean)
    .join(" ");

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
        <button
          type="button"
          onClick={() => { setEditingFacts(true); setTenure(view.tenure); setPurchaseType(view.purchaseType); setShareOfFreehold(view.isShareOfFreehold); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: SECONDARY, textDecoration: "underline" }}
        >
          Edit type
        </button>
      </div>

      <p style={{ padding: "0 16px 8px", margin: 0, fontSize: 11, color: MUTED }}>{txt.reportedBy}</p>

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

              <div style={{ flexShrink: 0 }}>
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
                  <Button variant="secondary" size="xs" disabled={pending} onClick={() => { setConfirmingCode(step.code); setConfirmDate(""); setError(null); }}>
                    Confirm
                  </Button>
                ) : null}
              </div>
            </div>

            {confirmingCode === step.code && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <label style={{ fontSize: 11, color: MUTED }}>
                  {step.eventDateRequired ? "Date it happened" : "Date (optional)"}
                </label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
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
