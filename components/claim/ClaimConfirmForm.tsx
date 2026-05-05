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
    // loading stays true — component unmounts on navigation
  }

  const btnBase: React.CSSProperties = {
    width: "100%",
    padding: "13px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    cursor: loading ? "not-allowed" : "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
    opacity: loading ? 0.6 : 1,
  };

  if (!hasDuplicates) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#4a5162", lineHeight: 1.6 }}>
          A new transaction file will be created in your dashboard with the property address pre-filled.
          You&apos;ll be able to add details after claiming.
        </p>

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        <button
          onClick={() => claim("create")}
          disabled={loading}
          style={{ ...btnBase, background: loading ? "#f1a591" : "#FF6B4A", color: "#fff", boxShadow: "0 4px 16px rgba(255,107,74,0.28)" }}
        >
          {loading ? "Claiming…" : "Claim and create file"}
        </button>

        <a
          href={`/claim?token=${token}`}
          style={{ display: "block", textAlign: "center", fontSize: 13, color: "#8b91a3", textDecoration: "none", marginTop: 4 }}
        >
          Cancel
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#4a5162" }}>What would you like to do?</p>

      {/* Duplicate entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {duplicates.map((dup) => (
          <div key={dup.transactionId} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "#1a1d29" }}>
              {dup.propertyAddress}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>
              Created{" "}
              {new Date(dup.createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {/* Link existing — recommended */}
      <div style={{ border: "1px solid #d1fae5", borderRadius: 12, padding: "16px", background: "#f0fdf4" }}>
        <button
          onClick={() => claim("link", duplicates[0]!.transactionId)}
          disabled={loading}
          style={{ ...btnBase, background: loading ? "#6ee7b7" : "#10b981", color: "#fff" }}
        >
          {loading ? "Linking…" : "Link this file to the chain"}
        </button>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#059669", lineHeight: 1.5 }}>
          Recommended — your existing progress carries over and becomes visible to other chain agents
        </p>
      </div>

      {/* Create new file */}
      <div>
        <button
          onClick={() => claim("create")}
          disabled={loading}
          style={{ ...btnBase, background: "#f1f5f9", color: "#4a5162" }}
        >
          Create a separate new file
        </button>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8b91a3", lineHeight: 1.5 }}>
          Use this if the invite is for a different property that happens to share an address
        </p>
      </div>

      <a
        href={`/claim?token=${token}`}
        style={{ display: "block", textAlign: "center", fontSize: 13, color: "#8b91a3", textDecoration: "none", marginTop: 4 }}
      >
        Cancel
      </a>
    </div>
  );
}
