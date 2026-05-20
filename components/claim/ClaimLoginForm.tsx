"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { markWelcomeSeenAction } from "@/app/actions/profile";

type Props = {
  token: string;
  stubEmail: string;
};

export function ClaimLoginForm({ token, stubEmail }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenure, setTenure] = useState<"freehold" | "leasehold" | null>(null);
  const [purchaseType, setPurchaseType] = useState<"mortgage" | "cash_buyer" | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);

  const canSubmit = password.length > 0 && tenure !== null && purchaseType !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email: stubEmail,
      password,
      redirect: false,
    });

    if (result?.error || !result?.ok) {
      setLoading(false);
      setError("Incorrect password. Please try again.");
      return;
    }

    const claimRes = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "create", tenure, purchaseType, isShareOfFreehold }),
    });

    if (!claimRes.ok) {
      const data = await claimRes.json().catch(() => ({}));
      setLoading(false);
      setError((data as { error?: string }).error ?? "Couldn't link your sale. Try again, or contact support if it keeps happening.");
      return;
    }

    const { transactionId } = (await claimRes.json()) as { transactionId: string };
    await markWelcomeSeenAction().catch(() => {});
    router.push(`/agent/transactions/${transactionId}?claimed=1`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Email — locked */}
      <div className="claim-field">
        <label className="claim-field-label">Email</label>
        <input
          className="claim-field-input"
          type="email"
          value={stubEmail}
          readOnly
          style={{ background: "#F4F4F4", color: "#8b91a3", cursor: "not-allowed" }}
          title="Email address is set by the invite"
        />
      </div>

      {/* Password */}
      <div className="claim-field claim-field-gap">
        <label className="claim-field-label">Password</label>
        <div className="claim-field-row">
          <input
            className="claim-field-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            style={{ paddingRight: 42 }}
            autoFocus
          />
          <button
            type="button"
            className="claim-field-toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        <p className="claim-form-forgot">
          Forgot your password?{" "}
          <a href="/forgot-password" style={{ color: "#8b91a3", fontWeight: 600, textDecoration: "none" }}>
            Reset it
          </a>
        </p>
      </div>

      {/* Sale details */}
      <div className="claim-sale-details">
        <p className="claim-sale-details-note">Two details to set up your file.</p>
        <div>
          <label className="claim-field-label">Tenure</label>
          <div className="claim-segment-pill-row">
            <button type="button" className={`claim-segment-pill${tenure === "freehold" ? " on" : ""}`} onClick={() => { setTenure("freehold"); setIsShareOfFreehold(false); }}>Freehold</button>
            <button type="button" className={`claim-segment-pill${tenure === "leasehold" ? " on" : ""}`} onClick={() => setTenure("leasehold")}>Leasehold</button>
          </div>
        </div>
        <div>
          <label className="claim-field-label">Purchase type</label>
          <div className="claim-segment-pill-row">
            <button type="button" className={`claim-segment-pill${purchaseType === "mortgage" ? " on" : ""}`} onClick={() => setPurchaseType("mortgage")}>Mortgage</button>
            <button type="button" className={`claim-segment-pill${purchaseType === "cash_buyer" ? " on" : ""}`} onClick={() => setPurchaseType("cash_buyer")}>Cash purchase</button>
          </div>
        </div>
        {tenure === "leasehold" && (
          <label className="claim-share-of-freehold">
            <input type="checkbox" checked={isShareOfFreehold} onChange={(e) => setIsShareOfFreehold(e.target.checked)} />
            Share of freehold
          </label>
        )}
      </div>

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
        type="submit"
        disabled={!canSubmit || loading}
        className="claim-btn"
        style={{ marginTop: 4 }}
      >
        {loading ? "Signing in…" : "Log in & claim"}
      </button>
    </form>
  );
}
