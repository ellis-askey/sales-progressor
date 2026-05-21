"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReconcileMilestonePicker,
  type MilestoneDefinitionLite,
  type ReconciliationState,
} from "@/components/milestones/ReconcileMilestonePicker";

type DuplicateEntry = {
  transactionId: string;
  propertyAddress: string;
  createdAt: string; // ISO string
};

type Props = {
  token: string;
  stubAddress: string;
  duplicates: DuplicateEntry[];
  milestoneDefinitions: MilestoneDefinitionLite[];
};

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

type ReconciliationMode = "fresh" | "in_progress" | "later";

export function ClaimConfirmForm({ token, stubAddress, duplicates, milestoneDefinitions }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupChoice, setDupChoice] = useState<"create" | "link">(
    duplicates.length > 0 ? "link" : "create"
  );
  const [tenure, setTenure] = useState<Tenure | null>(null);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);

  // Reconciliation state — only used when creating a new transaction (link path skips this)
  const [reconciliationMode, setReconciliationMode] = useState<ReconciliationMode | null>(null);
  // Keyed by milestone DEFINITION ID. eventDate is YYYY-MM-DD string or null.
  const [reconciledMilestones, setReconciledMilestones] = useState<ReconciliationState>({});
  // Two-step wizard when reconciliationMode === "in_progress": vendor then purchaser.
  const [wizardStep, setWizardStep] = useState<"vendor" | "purchaser">("vendor");

  const hasDuplicates = duplicates.length > 0;
  const needsSaleDetails = !hasDuplicates || dupChoice === "create";

  // Main submit is gated on:
  //   - non-reconcile path: just need details + a mode picked
  //   - in_progress wizard: only enable on purchaser step (vendor step shows "Next" instead)
  const onPurchaserStep = reconciliationMode !== "in_progress" || wizardStep === "purchaser";
  const canSubmit = needsSaleDetails
    ? tenure !== null && purchaseType !== null && reconciliationMode !== null && onPurchaserStep && !loading
    : !loading;

  async function claim(action: "create" | "link", existingTransactionId?: string) {
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = { token, action, existingTransactionId };
    if (needsSaleDetails) {
      body.tenure = tenure;
      body.purchaseType = purchaseType;
      body.isShareOfFreehold = isShareOfFreehold;
      body.reconciliationMode = reconciliationMode;
      // Only send completions list when agent is reconciling. Server (Commit 6) processes these.
      if (reconciliationMode === "in_progress") {
        body.reconciledMilestones = Object.entries(reconciledMilestones)
          .filter(([, v]) => v.ticked)
          .map(([milestoneDefinitionId, v]) => ({
            milestoneDefinitionId,
            eventDate: v.eventDate || null,
          }));
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

  const isWizardActive = reconciliationMode === "in_progress";
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
    <div className={`claim-sale-details${isWizardActive ? " collapsed" : ""}`}>
      <p className="claim-sale-details-note">Two details to set up your file.</p>

      <div>
        <label className="claim-field-label">Tenure</label>
        <div className="claim-segment-pill-row">
          <button
            type="button"
            className={`claim-segment-pill${tenure === "freehold" ? " on" : ""}`}
            onClick={() => { setTenure("freehold"); setIsShareOfFreehold(false); }}
          >
            Freehold
          </button>
          <button
            type="button"
            className={`claim-segment-pill${tenure === "leasehold" ? " on" : ""}`}
            onClick={() => setTenure("leasehold")}
          >
            Leasehold
          </button>
        </div>
      </div>

      <div>
        <label className="claim-field-label">Purchase type</label>
        <div className="claim-segment-pill-row">
          <button
            type="button"
            className={`claim-segment-pill${purchaseType === "mortgage" ? " on" : ""}`}
            onClick={() => setPurchaseType("mortgage")}
          >
            Mortgage
          </button>
          <button
            type="button"
            className={`claim-segment-pill${purchaseType === "cash_buyer" ? " on" : ""}`}
            onClick={() => setPurchaseType("cash_buyer")}
          >
            Cash purchase
          </button>
          <button
            type="button"
            className={`claim-segment-pill${purchaseType === "cash_from_proceeds" ? " on" : ""}`}
            onClick={() => setPurchaseType("cash_from_proceeds")}
          >
            Cash from Proceeds
          </button>
        </div>
      </div>

      {tenure === "leasehold" && (
        <label className="claim-share-of-freehold">
          <input
            type="checkbox"
            checked={isShareOfFreehold}
            onChange={(e) => setIsShareOfFreehold(e.target.checked)}
          />
          Share of freehold
        </label>
      )}
    </div>
    </>
  );

  // Reconciliation picker — only shown when creating a fresh transaction
  // AND tenure + purchaseType are selected (since we filter milestones by those).
  const reconciliationSection = needsSaleDetails && tenure && purchaseType && (
    <div className="claim-reconcile">
      <p className="claim-field-label">Where is this sale up to?</p>

      <button
        type="button"
        className={`claim-reconcile-option${reconciliationMode === "fresh" ? " on" : ""}`}
        onClick={() => setReconciliationMode("fresh")}
      >
        <span className="claim-reconcile-option-title">Just starting</span>
        <span className="claim-reconcile-option-sub">No work done yet — start with a clean file</span>
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
        {reconciliationSection}
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
              {dup.propertyAddress} — added{" "}
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
      {reconciliationSection}

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

