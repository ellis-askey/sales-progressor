"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ReconcileMilestonePicker,
  type MilestoneDefinitionLite,
  type ReconciliationState,
} from "@/components/milestones/ReconcileMilestonePicker";
import { ClaimSaleTypeFields } from "@/components/claim/ClaimSaleTypeFields";

type DuplicateEntry = {
  transactionId: string;
  propertyAddress: string;
  createdAt: string; // ISO string
};

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

// Stage 3: seller-below's reported onward progress, offered as a pre-filled
// head-start for the reconciliation wizard.
type OnwardInheritance = {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  stepDefIds: string[]; // purchaser-side milestone definition ids to pre-tick
};

type Props = {
  token: string;
  stubAddress: string;
  duplicates: DuplicateEntry[];
  milestoneDefinitions: MilestoneDefinitionLite[];
  inheritance?: OnwardInheritance | null;
};

type ReconciliationMode = "fresh" | "in_progress" | "later";

export function ClaimConfirmForm({ token, stubAddress, duplicates, milestoneDefinitions, inheritance }: Props) {
  const router = useRouter();
  const hasInheritance = !!(inheritance && inheritance.stepDefIds.length > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupChoice, setDupChoice] = useState<"create" | "link">(
    duplicates.length > 0 ? "link" : "create"
  );
  const [tenure, setTenure] = useState<Tenure | null>(inheritance?.tenure ?? null);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(inheritance?.purchaseType ?? null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(inheritance?.isShareOfFreehold ?? false);

  // Reconciliation state — only used when creating a new transaction (link path skips this).
  // When the seller below reported onward progress, default to "already in progress"
  // and pre-tick their reported steps for the claiming agent to review.
  const [reconciliationMode, setReconciliationMode] = useState<ReconciliationMode | null>(
    hasInheritance ? "in_progress" : null,
  );
  // Keyed by milestone DEFINITION ID. eventDate is YYYY-MM-DD string or null.
  const [reconciledMilestones, setReconciledMilestones] = useState<ReconciliationState>(() => {
    if (!hasInheritance) return {};
    const init: ReconciliationState = {};
    for (const id of inheritance!.stepDefIds) init[id] = { ticked: true, eventDate: "" };
    return init;
  });
  // Two-step wizard when reconciliationMode === "in_progress": vendor then purchaser.
  const [wizardStep, setWizardStep] = useState<"vendor" | "purchaser">("vendor");

  const hasDuplicates = duplicates.length > 0;
  const needsSaleDetails = !hasDuplicates || dupChoice === "create";

  // Main submit is gated on:
  //   - non-reconcile path: just need details + a mode picked
  //   - in_progress wizard: only enable on purchaser step (vendor step shows "Next" instead)
  // Reconciliation ("Where is this sale up to?") is hidden here — it's moving to a
  // post-claim step. All of its code (section + wizard) is kept below, gated on this
  // flag so it can be relocated without rebuilding. // lands: reconcile relocation.
  const SHOW_RECONCILE = false;
  const onPurchaserStep = !SHOW_RECONCILE || reconciliationMode !== "in_progress" || wizardStep === "purchaser";
  const canSubmit = needsSaleDetails
    ? tenure !== null && purchaseType !== null && (!SHOW_RECONCILE || reconciliationMode !== null) && onPurchaserStep && !loading
    : !loading;

  // When both details are chosen (i.e. the 2nd click makes the CTA relevant) and
  // the card's bottom sits below the fold, scroll it into view so the button + a
  // little space are visible. Skips if it's already in view; honours reduced-motion.
  const submitRef = useRef<HTMLButtonElement>(null);
  const bothSelectedRef = useRef(false);
  useEffect(() => {
    const both = tenure !== null && purchaseType !== null;
    if (both && !bothSelectedRef.current) {
      const card = submitRef.current?.closest(".claim-form-card");
      if (card) {
        const rect = card.getBoundingClientRect();
        if (rect.bottom > window.innerHeight - 8) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
        }
      }
    }
    bothSelectedRef.current = both;
  }, [tenure, purchaseType]);

  async function claim(action: "create" | "link", existingTransactionId?: string) {
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = { token, action, existingTransactionId };
    if (needsSaleDetails) {
      body.tenure = tenure;
      body.purchaseType = purchaseType;
      body.isShareOfFreehold = isShareOfFreehold;
      // Reconciliation is hidden (moving to a post-claim step) — don't send it, so
      // the claim just creates a clean file. Kept behind the flag for relocation.
      if (SHOW_RECONCILE) {
        body.reconciliationMode = reconciliationMode;
        if (reconciliationMode === "in_progress") {
          body.reconciledMilestones = Object.entries(reconciledMilestones)
            .filter(([, v]) => v.ticked)
            .map(([milestoneDefinitionId, v]) => ({
              milestoneDefinitionId,
              eventDate: v.eventDate || null,
            }));
        }
      }
    }

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError((data as { error?: string }).error ?? "Something didn't work. Try again, or contact support if it keeps happening.");
      return;
    }

    const { transactionId } = (await res.json()) as { transactionId: string };
    // If the agent chose "I'll set this up later", set a localStorage flag so the
    // transaction page shows the reconcile-later banner. localStorage is intentional —
    // banner is a per-device reminder, not server-persisted state.
    if (reconciliationMode === "later" && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(`reconcileLater:${transactionId}`, "1");
      } catch {
        // localStorage unavailable (private mode etc.) — banner just won't show. Not fatal.
      }
    }
    router.push(`/agent/transactions/${transactionId}?claimed=1`);
  }

  function handleClaim() {
    if (!hasDuplicates || dupChoice === "create") {
      claim("create");
    } else {
      claim("link", duplicates[0]!.transactionId);
    }
  }

  const isWizardActive = SHOW_RECONCILE && reconciliationMode === "in_progress";
  const saleDetailsLabel = tenure && purchaseType
    ? `${tenure === "leasehold" ? (isShareOfFreehold ? "Leasehold (share of freehold)" : "Leasehold") : "Freehold"} · ${purchaseType === "mortgage" ? "Mortgage" : purchaseType === "cash_buyer" ? "Cash purchase" : "Cash from Proceeds"}`
    : "";

  const saleDetailsSection = needsSaleDetails && (
    <>
      {isWizardActive && saleDetailsLabel && (
        <button
          type="button"
          className="claim-sale-details-summary"
          onClick={() => { setReconciliationMode(null); setWizardStep("vendor"); }}
          aria-label="Edit sale details"
        >
          <span>{saleDetailsLabel}</span>
          <span className="claim-sale-details-summary-edit">Edit</span>
        </button>
      )}
    <div className={`claim-sale-details claim-sale-details--nocollapse${isWizardActive ? " collapsed" : ""}`}>
      <ClaimSaleTypeFields
        tenure={tenure}
        purchaseType={purchaseType}
        isShareOfFreehold={isShareOfFreehold}
        onTenure={setTenure}
        onPurchaseType={setPurchaseType}
        onShareOfFreehold={setIsShareOfFreehold}
      />
    </div>
    </>
  );

  // Reconciliation picker — only shown when creating a fresh transaction
  // AND tenure + purchaseType are selected (since we filter milestones by those).
  const reconciliationSection = needsSaleDetails && tenure && purchaseType && (
    <div className="claim-reconcile">
      <p className="claim-field-label">Where is this sale up to?</p>

      {hasInheritance && (
        <div style={{ background: "rgba(255,107,74,0.08)", border: "1px solid rgba(255,107,74,0.25)", borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.4, color: "#8a3a24", marginBottom: 12 }}>
          The buyer reported this progress on their side already. We&apos;ve pre-ticked it below, review and adjust before you claim.
        </div>
      )}

      <button
        type="button"
        className={`claim-reconcile-option${reconciliationMode === "fresh" ? " on" : ""}`}
        onClick={() => setReconciliationMode("fresh")}
      >
        <span className="claim-reconcile-option-title">Just starting</span>
        <span className="claim-reconcile-option-sub">No work done yet, start with a clean file</span>
      </button>

      <button
        type="button"
        className={`claim-reconcile-option${reconciliationMode === "in_progress" ? " on" : ""}`}
        onClick={() => setReconciliationMode("in_progress")}
      >
        <span className="claim-reconcile-option-title">Already in progress</span>
        <span className="claim-reconcile-option-sub">
          Tick what's already done. Add real-world dates if you know them, leave blank if not.
        </span>
      </button>

      <button
        type="button"
        className={`claim-reconcile-option${reconciliationMode === "later" ? " on" : ""}`}
        onClick={() => setReconciliationMode("later")}
      >
        <span className="claim-reconcile-option-title">I'll set this up later</span>
        <span className="claim-reconcile-option-sub">Claim now, mark completed milestones from the file page</span>
      </button>

      {reconciliationMode === "in_progress" && tenure && purchaseType && (
        <>
          {wizardStep === "purchaser" && (
            <button
              type="button"
              className="claim-wizard-back"
              onClick={() => setWizardStep("vendor")}
            >
              ← Back to seller milestones
            </button>
          )}
          <ReconcileMilestonePicker
            milestoneDefinitions={milestoneDefinitions}
            tenure={tenure}
            purchaseType={purchaseType}
            state={reconciledMilestones}
            onChange={setReconciledMilestones}
            side={wizardStep}
          />
          {wizardStep === "vendor" && (
            <button
              type="button"
              className="claim-btn"
              onClick={() => setWizardStep("purchaser")}
              style={{ marginTop: 12 }}
            >
              Next: Buyer milestones →
            </button>
          )}
        </>
      )}
    </div>
  );

  if (!hasDuplicates) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {saleDetailsSection}
        {SHOW_RECONCILE && reconciliationSection}
        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "10px 14px",
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}
        {onPurchaserStep && (
          <button
            ref={submitRef}
            onClick={handleClaim}
            disabled={!canSubmit}
            className="claim-btn"
            style={{ marginTop: 8 }}
          >
            {loading ? "Claiming…" : "Claim this sale"}
          </button>
        )}
      </div>
    );
  }

  // Has duplicates — radio picker
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Create option */}
      <div
        className={`claim-dup-option${dupChoice === "create" ? " selected" : ""}`}
        onClick={() => setDupChoice("create")}
      >
        <div className="claim-dup-radio" />
        <div>
          <p className="claim-dup-label">Create a new sale for this address</p>
          <p className="claim-dup-sub">
            Start a fresh file for {stubAddress || "this property"}
          </p>
        </div>
      </div>

      {/* Link existing options */}
      {duplicates.map((dup) => (
        <div
          key={dup.transactionId}
          className={`claim-dup-option${dupChoice === "link" ? " selected" : ""}`}
          onClick={() => setDupChoice("link")}
        >
          <div className="claim-dup-radio" />
          <div>
            <p className="claim-dup-label">Link my existing sale</p>
            <p className="claim-dup-sub">
              {dup.propertyAddress}, added{" "}
              {new Date(dup.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      ))}

      {saleDetailsSection}
      {SHOW_RECONCILE && reconciliationSection}

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}

      {onPurchaserStep && (
        <button
          ref={submitRef}
          onClick={handleClaim}
          disabled={!canSubmit}
          className="claim-btn"
          style={{ marginTop: 4 }}
        >
          {loading
            ? "Claiming…"
            : dupChoice === "link"
            ? "Link this sale to the chain"
            : "Claim this sale"}
        </button>
      )}
    </div>
  );
}

