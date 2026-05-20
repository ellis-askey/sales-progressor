"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DuplicateEntry = {
  transactionId: string;
  propertyAddress: string;
  createdAt: string; // ISO string
};

type Props = {
  token: string;
  stubAddress: string;
  duplicates: DuplicateEntry[];
};

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer";

export function ClaimConfirmForm({ token, stubAddress, duplicates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupChoice, setDupChoice] = useState<"create" | "link">(
    duplicates.length > 0 ? "link" : "create"
  );
  const [tenure, setTenure] = useState<Tenure | null>(null);
  const [purchaseType, setPurchaseType] = useState<PurchaseType | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);

  const hasDuplicates = duplicates.length > 0;
  const needsSaleDetails = !hasDuplicates || dupChoice === "create";

  const canSubmit = needsSaleDetails
    ? tenure !== null && purchaseType !== null && !loading
    : !loading;

  async function claim(action: "create" | "link", existingTransactionId?: string) {
    setError(null);
    setLoading(true);

    const body: Record<string, unknown> = { token, action, existingTransactionId };
    if (needsSaleDetails) {
      body.tenure = tenure;
      body.purchaseType = purchaseType;
      body.isShareOfFreehold = isShareOfFreehold;
    }

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLoading(false);
      setError((data as { error?: string }).error ?? "Something went wrong. Please try again.");
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
      <p className="claim-sale-details-note">We need two quick details to set up your milestones.</p>

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

  if (!hasDuplicates) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {saleDetailsSection}
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
