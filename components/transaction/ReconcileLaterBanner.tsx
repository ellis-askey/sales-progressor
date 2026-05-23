"use client";

// Reconcile-later banner — shown on the transaction page when the agent chose
// "I'll set this up later" on the claim form (a localStorage flag is set there).
//
// Banner persists until the agent either reconciles via the modal or dismisses
// it with ×. Both actions clear the localStorage flag.
//
// Per Stage 1 ruling Q1: persistent (no auto-timeout), transaction page only,
// dismissable.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Info } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";
import {
  ReconcileMilestonePicker,
  type MilestoneDefinitionLite,
  type ReconciliationState,
} from "@/components/milestones/ReconcileMilestonePicker";
import { reconcileClaimMilestonesAction } from "@/app/actions/milestones";
// Loads the .claim-reconcile-* / .claim-btn styles the picker + modal use.
// CSS selectors are scoped to .claim-page ancestor so they don't bleed onto the rest of the page.
import "@/app/claim/styles/claim-flow.css";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

export function ReconcileLaterBanner({
  transactionId,
  milestoneDefinitions,
  tenure,
  purchaseType,
}: {
  transactionId: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<ReconciliationState>({});
  const [error, setError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<"vendor" | "purchaser">("vendor");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const flag = window.localStorage.getItem(`reconcileLater:${transactionId}`);
      if (flag === "1") setVisible(true);
    } catch {
      // localStorage unavailable — banner just doesn't show. Not fatal.
    }
  }, [transactionId]);

  function clearFlag() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(`reconcileLater:${transactionId}`);
    } catch {
      // ignore
    }
  }

  function handleDismiss() {
    clearFlag();
    setVisible(false);
  }

  async function handleSubmit() {
    if (!tenure || !purchaseType) {
      setError("This file is missing tenure or purchase type — can't reconcile.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const completions = Object.entries(state)
        .filter(([, v]) => v.ticked)
        .map(([milestoneDefinitionId, v]) => ({
          milestoneDefinitionId,
          eventDate: v.eventDate || null,
        }));
      if (completions.length === 0) {
        // Nothing ticked — close modal but don't clear flag (agent might come back)
        setModalOpen(false);
        setSubmitting(false);
        return;
      }
      await reconcileClaimMilestonesAction({ transactionId, completions });
      clearFlag();
      setVisible(false);
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[ReconcileLaterBanner] reconciliation failed:", err);
      setError("Couldn't save your selections. Try again.");
      setSubmitting(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <AgentBanner
        kind="info"
        icon={<Info size={18} weight="fill" />}
        title="Bring this file up to date"
        body="Mark which milestones are already done and (if you know) when they happened — your file's timeline and predictions will track accurately from there."
        action={{ label: "Set up milestones →", onClick: () => setModalOpen(true) }}
        dismissible={{ onDismiss: handleDismiss }}
        className="mb-1"
      />

      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <ReconcileModal
            tenure={tenure}
            purchaseType={purchaseType}
            milestoneDefinitions={milestoneDefinitions}
            state={state}
            onChange={setState}
            submitting={submitting}
            error={error}
            wizardStep={wizardStep}
            onStepChange={setWizardStep}
            onClose={() => setModalOpen(false)}
            onSubmit={handleSubmit}
          />,
          document.body,
        )}
    </>
  );
}

function ReconcileModal({
  tenure,
  purchaseType,
  milestoneDefinitions,
  state,
  onChange,
  submitting,
  error,
  wizardStep,
  onStepChange,
  onClose,
  onSubmit,
}: {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  milestoneDefinitions: MilestoneDefinitionLite[];
  state: ReconciliationState;
  onChange: (next: ReconciliationState) => void;
  submitting: boolean;
  error: string | null;
  wizardStep: "vendor" | "purchaser";
  onStepChange: (step: "vendor" | "purchaser") => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const tickedCount = Object.values(state).filter((r) => r.ticked).length;
  const onPurchaserStep = wizardStep === "purchaser";

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="claim-page"
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1a1d29" }}>
              Set up which milestones are done
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#4a5162" }}>
              Tick what's already happened. Add the date if you know it; leave blank if you don&apos;t.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#8b91a3", padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {tenure && purchaseType ? (
          <>
            {wizardStep === "purchaser" && (
              <button
                type="button"
                className="claim-wizard-back"
                onClick={() => onStepChange("vendor")}
                style={{ marginBottom: 12 }}
              >
                ← Back to seller milestones
              </button>
            )}
            <ReconcileMilestonePicker
              milestoneDefinitions={milestoneDefinitions}
              tenure={tenure}
              purchaseType={purchaseType}
              state={state}
              onChange={onChange}
              side={wizardStep}
            />
          </>
        ) : (
          <p style={{ fontSize: 13, color: "#dc2626" }}>
            This file is missing tenure or purchase type — can&apos;t reconcile until those are set.
          </p>
        )}

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            className="claim-btn claim-btn--ghost"
            type="button"
          >
            Cancel
          </button>
          {onPurchaserStep ? (
            <button
              onClick={onSubmit}
              disabled={submitting || !tenure || !purchaseType}
              className="claim-btn"
              type="button"
            >
              {submitting ? "Saving…" : tickedCount > 0 ? `Save ${tickedCount} milestone${tickedCount === 1 ? "" : "s"}` : "Save"}
            </button>
          ) : (
            <button
              onClick={() => onStepChange("purchaser")}
              disabled={submitting || !tenure || !purchaseType}
              className="claim-btn"
              type="button"
            >
              Next: Buyer milestones →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
