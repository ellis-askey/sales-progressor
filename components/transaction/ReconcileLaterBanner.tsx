"use client";

// "Where's this sale up to?" — the re-homed reconcile step. Shown as a compact
// prompt strip on a freshly claimed file's Overview, until the agent completes
// their first step (hasProgress) or dismisses it ("Not now"). Opening it runs the
// same two-step (vendor → purchaser) tick-list and applies via the existing
// reconcileClaimMilestonesAction — no data-logic change, just a new home + look.
//
// (Kept the ReconcileLaterBanner name so the async wrapper wiring is unchanged.)

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Clock, X, ArrowRight, ArrowLeft, Check } from "@phosphor-icons/react";
import {
  ReconcileMilestonePicker,
  type MilestoneDefinitionLite,
  type ReconciliationState,
} from "@/components/milestones/ReconcileMilestonePicker";
import { reconcileClaimMilestonesAction } from "@/app/actions/milestones";
// Loads the .claim-reconcile-* / .rec-* styles the picker + modal use.
import "@/app/claim/styles/claim-flow.css";

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

export function ReconcileLaterBanner({
  transactionId,
  milestoneDefinitions,
  tenure,
  purchaseType,
  hasProgress = false,
}: {
  transactionId: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  // True once the file has any completed step — the prompt then retires itself.
  hasProgress?: boolean;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<ReconciliationState>({});
  const [error, setError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<"vendor" | "purchaser">("vendor");

  // Persisted "Not now" so the prompt stays gone once dismissed.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(`reconcileDismissed:${transactionId}`) === "1") setDismissed(true);
    } catch {
      // localStorage unavailable — prompt just shows. Not fatal.
    }
  }, [transactionId]);

  // The claim welcome modal's "Set up" button opens this directly.
  useEffect(() => {
    function onOpen() {
      setDismissed(false);
      setModalOpen(true);
    }
    window.addEventListener("sp:open-reconcile", onOpen);
    return () => window.removeEventListener("sp:open-reconcile", onOpen);
  }, []);

  function handleDismiss() {
    try {
      window.localStorage.setItem(`reconcileDismissed:${transactionId}`, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  }

  async function handleSubmit() {
    if (!tenure || !purchaseType) {
      setError("This file is missing tenure or purchase type, so it can't be set up yet.");
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
        setModalOpen(false);
        setSubmitting(false);
        return;
      }
      await reconcileClaimMilestonesAction({ transactionId, completions });
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      console.error("[reconcile] failed:", err);
      setError("Couldn't save your selections. Try again.");
      setSubmitting(false);
    }
  }

  const showPrompt = !hasProgress && !dismissed && !!tenure && !!purchaseType;

  if (!showPrompt && !modalOpen) return null;

  return (
    <>
      {showPrompt && (
        <div className="rec-prompt">
          <span className="rec-prompt-icon" aria-hidden="true">
            <Clock size={30} weight="regular" />
          </span>
          <div className="rec-prompt-text">
            <p className="rec-prompt-title">Where&rsquo;s this sale up to?</p>
            <p className="rec-prompt-body">
              Looks like a new file. Tick what&rsquo;s already been done and we&rsquo;ll bring the timeline and
              predictions up to date.
            </p>
          </div>
          <div className="rec-prompt-actions">
            <button type="button" className="rec-prompt-cta" onClick={() => setModalOpen(true)}>
              Update progress
              <ArrowRight size={15} weight="bold" />
            </button>
            <button type="button" className="rec-prompt-dismiss" onClick={handleDismiss}>
              Not now
            </button>
          </div>
        </div>
      )}

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

type StepState = "active" | "done" | "pending";

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
  const onVendor = wizardStep === "vendor";

  const railSteps: { key: string; label: string; sub: string; state: StepState }[] = [
    {
      key: "vendor",
      label: "Selling side",
      sub: "Tick what's already done",
      state: submitting ? "done" : onVendor ? "active" : "done",
    },
    {
      key: "purchaser",
      label: "Buying side",
      sub: "Then the buyer's steps",
      state: submitting ? "done" : onVendor ? "pending" : "active",
    },
    {
      key: "done",
      label: "Done",
      sub: "We'll update your file",
      state: submitting ? "active" : "pending",
    },
  ];

  return (
    <div
      className="rec-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="rec-modal rec-scope">
        <button type="button" className="rec-close" aria-label="Close" onClick={onClose} disabled={submitting}>
          <X size={16} weight="bold" />
        </button>

        <aside className="rec-rail">
          <p className="rec-rail-eyebrow">Where&rsquo;s this sale up to?</p>
          <ol className="rec-steps">
            {railSteps.map((s, i) => (
              <li key={s.key} className={`rec-step is-${s.state}`}>
                <span className="rec-step-num">
                  {s.state === "done" ? <Check size={14} weight="bold" /> : i + 1}
                </span>
                <span className="rec-step-text">
                  <span className="rec-step-label">{s.label}</span>
                  <span className="rec-step-sub">{s.sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>

        <section className="rec-content">
          <div className="rec-content-scroll">
            <div className="rec-content-inner" key={wizardStep}>
              <h2 className="rec-head">{onVendor ? "Let's start with the selling side." : "Now the buying side."}</h2>
              <p className="rec-lede">
                Tick the steps that have already been completed. Add the real-world date if you know it.
              </p>

              {tenure && purchaseType ? (
                <ReconcileMilestonePicker
                  milestoneDefinitions={milestoneDefinitions}
                  tenure={tenure}
                  purchaseType={purchaseType}
                  state={state}
                  onChange={onChange}
                  side={wizardStep}
                  layout="wide"
                />
              ) : (
                <p className="rec-missing">
                  This file is missing tenure or purchase type, so it can&rsquo;t be set up until those are added.
                </p>
              )}

              {error && <div className="rec-error">{error}</div>}
            </div>
          </div>

          <div className="rec-footer">
            {onVendor ? (
              <button type="button" className="rec-textbtn" onClick={onClose} disabled={submitting}>
                Save and come back
              </button>
            ) : (
              <button type="button" className="rec-textbtn" onClick={() => onStepChange("vendor")} disabled={submitting}>
                <ArrowLeft size={14} weight="bold" /> Back to selling side
              </button>
            )}
            {onVendor ? (
              <button
                type="button"
                className="rec-primary"
                onClick={() => onStepChange("purchaser")}
                disabled={!tenure || !purchaseType}
              >
                Continue to buying side <ArrowRight size={16} weight="bold" />
              </button>
            ) : (
              <button
                type="button"
                className="rec-primary"
                onClick={onSubmit}
                disabled={submitting || !tenure || !purchaseType}
              >
                {submitting ? "Updating…" : "Finish and update file"}
                {!submitting && <ArrowRight size={16} weight="bold" />}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
