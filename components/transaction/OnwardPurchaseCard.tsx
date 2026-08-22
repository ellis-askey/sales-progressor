"use client";

// Onward-Purchase Visibility arc — Stage 1 agent-side card.
//
// Shows a seller's REPORTED onward-purchase progress on their own file, beside
// the property-chain card. An internal user can open the tracker, set the two
// type facts (tenure + purchase method), and report the purchaser-side steps in
// the same prerequisite order the real engine enforces. Everything is labelled
// "reported" (Q7 — copy pending Ellis voice approval) and never leaves our side.
//
// Spec: docs/active/onward-visibility/00-discovery.md.

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import {
  openOnwardTrackerAction,
  setOnwardTypeFactsAction,
  confirmOnwardStepAction,
  undoOnwardStepAction,
} from "@/app/actions/onward";
import type { OnwardTrackerView, OnwardStepView } from "@/lib/services/onward";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

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

// The name of the first unmet prerequisite, resolved from the visible steps.
function blockingLabel(step: OnwardStepView, steps: OnwardStepView[]): string {
  if (step.code === "PM25") return "the steps above";
  const prereqs = DIRECT_PREREQUISITES[step.code] ?? [];
  const nameByCode = new Map(steps.map((s) => [s.code, s]));
  for (const p of prereqs) {
    const s = nameByCode.get(p);
    if (s && !s.isComplete) return s.name.toLowerCase();
  }
  return "an earlier step";
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
}: {
  transactionId: string;
  initialView: OnwardTrackerView;
}) {
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

  // ── Not opened yet ─────────────────────────────────────────────────────────
  if (!view.exists) {
    return (
      <Card id="onward-section" padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>Onward purchase</h3>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          <p style={{ margin: "0 0 10px" }}>
            If this seller is buying onward, track where their purchase is up to. Reported progress
            stays on this file and is not shared with other agencies.
          </p>
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => run(() => openOnwardTrackerAction(transactionId))}
          >
            Set up onward tracking
          </Button>
          {error && <p style={{ color: "var(--agent-danger, #c0392b)", fontSize: 12, marginTop: 8 }}>{error}</p>}
        </div>
      </Card>
    );
  }

  // ── Type-facts form (not set, or editing) ─────────────────────────────────
  const showFactsForm = !view.typeFactsSet || editingFacts;
  if (showFactsForm) {
    const canSave = tenure !== null && purchaseType !== null && !pending;
    return (
      <Card id="onward-section" padding="none">
        <div style={cardHeaderStyle}>
          <h3 style={titleStyle}>Onward purchase</h3>
          <span style={{ fontSize: 11, color: MUTED }}>Reported</span>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 13, color: MUTED }}>
          <p style={{ margin: "0 0 10px" }}>
            Tell us the onward property type and how they are buying, so we show the right steps.
          </p>

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

          <FactRow label="Buying with">
            <Pill on={purchaseType === "mortgage"} onClick={() => setPurchaseType("mortgage")}>Mortgage</Pill>
            <Pill on={purchaseType === "cash_buyer"} onClick={() => setPurchaseType("cash_buyer")}>Cash</Pill>
            <Pill on={purchaseType === "cash_from_proceeds"} onClick={() => setPurchaseType("cash_from_proceeds")}>Cash from proceeds</Pill>
          </FactRow>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <Button
              variant="primary"
              size="sm"
              loading={pending}
              disabled={!canSave}
              onClick={() =>
                run(async () => {
                  const next = await setOnwardTypeFactsAction({
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
  const factsSummary = [tenureLabel(view.tenure), view.isShareOfFreehold ? "(share of freehold)" : "", purchaseLabel(view.purchaseType)]
    .filter(Boolean)
    .join(" ");

  return (
    <Card id="onward-section" padding="none">
      <div style={cardHeaderStyle}>
        <h3 style={titleStyle}>Onward purchase</h3>
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

      <p style={{ padding: "0 16px 8px", margin: 0, fontSize: 11, color: MUTED }}>
        As reported by the seller. Not confirmed by the onward agent.
      </p>

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
                        const { result, view: next } = await undoOnwardStepAction({ transactionId, milestoneCode: step.code });
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
                      const { result, view: next } = await confirmOnwardStepAction({
                        transactionId,
                        milestoneCode: step.code,
                        eventDate: confirmDate || null,
                      });
                      if (result.ok === false) {
                        setError(result.reason === "locked" ? "Confirm the earlier step first." : "Could not report this step.");
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
