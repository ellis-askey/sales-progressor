"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type DuplicateEntry = {
  transactionId: string;
  propertyAddress: string;
  createdAt: string; // ISO string
};

type MilestoneDefinitionLite = {
  id: string;
  code: string;
  name: string;
  side: "vendor" | "purchaser";
  orderIndex: number;
};

type Props = {
  token: string;
  stubAddress: string;
  duplicates: DuplicateEntry[];
  milestoneDefinitions: MilestoneDefinitionLite[];
};

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer";

type ReconciliationMode = "fresh" | "in_progress" | "later";

// Auto-NR codes mirror initializeMilestoneCompletions in lib/services/milestones.ts.
// Hidden from the reconciliation picker because they're not relevant for this tenure/purchase combo.
function autoNrCodesFor(tenure: Tenure, purchaseType: PurchaseType): Set<string> {
  const codes = new Set<string>();
  if (tenure === "freehold") {
    codes.add("VM8");
    codes.add("VM9");
    codes.add("PM12");
  }
  if (purchaseType === "cash_buyer") {
    codes.add("PM5");
    codes.add("PM6");
    codes.add("PM11");
  }
  return codes;
}

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
  const [reconciledMilestones, setReconciledMilestones] = useState<
    Record<string, { ticked: boolean; eventDate: string | null }>
  >({});

  const hasDuplicates = duplicates.length > 0;
  const needsSaleDetails = !hasDuplicates || dupChoice === "create";

  // Filter milestone list to hide auto-NR codes for the chosen tenure/purchaseType.
  // Only computed when both are selected. Sorted by side then orderIndex.
  const filteredMilestones = useMemo(() => {
    if (!tenure || !purchaseType) return [];
    const autoNr = autoNrCodesFor(tenure, purchaseType);
    return milestoneDefinitions
      .filter((m) => !autoNr.has(m.code))
      .sort((a, b) => {
        if (a.side !== b.side) return a.side === "vendor" ? -1 : 1;
        return a.orderIndex - b.orderIndex;
      });
  }, [tenure, purchaseType, milestoneDefinitions]);

  const canSubmit = needsSaleDetails
    ? tenure !== null && purchaseType !== null && reconciliationMode !== null && !loading
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
    router.push(`/agent/transactions/${transactionId}?claimed=1`);
  }

  function handleClaim() {
    if (!hasDuplicates || dupChoice === "create") {
      claim("create");
    } else {
      claim("link", duplicates[0]!.transactionId);
    }
  }

  const saleDetailsSection = needsSaleDetails && (
    <div className="claim-sale-details">
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

      {reconciliationMode === "in_progress" && (
        <div className="claim-reconcile-list">
          <ReconcileMilestoneSection
            title="Vendor milestones"
            milestones={filteredMilestones.filter((m) => m.side === "vendor")}
            state={reconciledMilestones}
            onChange={setReconciledMilestones}
          />
          <ReconcileMilestoneSection
            title="Purchaser milestones"
            milestones={filteredMilestones.filter((m) => m.side === "purchaser")}
            state={reconciledMilestones}
            onChange={setReconciledMilestones}
          />
        </div>
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
        <button
          onClick={handleClaim}
          disabled={!canSubmit}
          className="claim-btn"
          style={{ marginTop: 8 }}
        >
          {loading ? "Claiming…" : "Claim this sale"}
        </button>
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
    </div>
  );
}

// ─── Reconcile milestone section ─────────────────────────────────────────────
// One side (vendor or purchaser). Each row: checkbox + name + (when ticked) date input.
// Date is optional — agent leaves blank if they don't know the real-world event date.

function ReconcileMilestoneSection({
  title,
  milestones,
  state,
  onChange,
}: {
  title: string;
  milestones: MilestoneDefinitionLite[];
  state: Record<string, { ticked: boolean; eventDate: string | null }>;
  onChange: (next: Record<string, { ticked: boolean; eventDate: string | null }>) => void;
}) {
  if (milestones.length === 0) return null;

  function setRow(id: string, patch: Partial<{ ticked: boolean; eventDate: string | null }>) {
    const existing = state[id] ?? { ticked: false, eventDate: null };
    onChange({ ...state, [id]: { ...existing, ...patch } });
  }

  return (
    <div className="claim-reconcile-section">
      <p className="claim-reconcile-section-title">{title}</p>
      <ul className="claim-reconcile-rows">
        {milestones.map((m) => {
          const row = state[m.id] ?? { ticked: false, eventDate: null };
          return (
            <li key={m.id} className={`claim-reconcile-row${row.ticked ? " on" : ""}`}>
              <label className="claim-reconcile-row-main">
                <input
                  type="checkbox"
                  checked={row.ticked}
                  onChange={(e) => setRow(m.id, { ticked: e.target.checked })}
                />
                <span className="claim-reconcile-row-code">{m.code}</span>
                <span className="claim-reconcile-row-name">{m.name}</span>
              </label>
              {row.ticked && (
                <input
                  type="date"
                  className="claim-reconcile-date"
                  value={row.eventDate ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRow(m.id, { eventDate: e.target.value || null })}
                  aria-label={`When did ${m.code} happen?`}
                  placeholder="Date (optional)"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
