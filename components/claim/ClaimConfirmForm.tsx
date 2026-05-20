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

export function ClaimConfirmForm({ token, stubAddress, duplicates }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupChoice, setDupChoice] = useState<"create" | "link">(
    duplicates.length > 0 ? "link" : "create"
  );

  const hasDuplicates = duplicates.length > 0;

  async function claim(action: "create" | "link", existingTransactionId?: string) {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, existingTransactionId }),
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

  if (!hasDuplicates) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
          disabled={loading}
          className="claim-btn"
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
        disabled={loading}
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
