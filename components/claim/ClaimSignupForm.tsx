"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { markWelcomeSeenAction } from "@/app/actions/profile";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type Props = {
  token: string;
  stubEmail: string;
  stubAgencyName: string;
};

export function ClaimSignupForm({ token, stubEmail, stubAgencyName }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firmName, setFirmName] = useState(toTitleCase(stubAgencyName));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenure, setTenure] = useState<"freehold" | "leasehold" | null>(null);
  const [purchaseType, setPurchaseType] = useState<"mortgage" | "cash_buyer" | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    password.length >= 8 &&
    firmName.trim().length > 0 &&
    tenure !== null &&
    purchaseType !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const name = `${firstName.trim()} ${lastName.trim()}`;

    const registerRes = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: stubEmail, password, firmName: firmName.trim(), role: "director" }),
    });

    if (!registerRes.ok) {
      const data = await registerRes.json().catch(() => ({}));
      setLoading(false);
      if (registerRes.status === 409) {
        setError("An account with this email already exists.");
      } else {
        setError((data as { error?: string }).error ?? "Something didn't work. Try again, or contact support if it keeps happening.");
      }
      return;
    }

    const signInResult = await signIn("credentials", {
      email: stubEmail,
      password,
      redirect: false,
    });

    if (signInResult?.error || !signInResult?.ok) {
      setLoading(false);
      setError("Account created but sign-in failed. Try logging in manually.");
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
    router.push(`/agent/transactions/${transactionId}?claimed=1&newUser=1`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Name row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="claim-field">
          <label className="claim-field-label">First name</label>
          <input
            className="claim-field-input"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            placeholder="Jane"
          />
        </div>
        <div className="claim-field">
          <label className="claim-field-label">Last name</label>
          <input
            className="claim-field-input"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
            placeholder="Smith"
          />
        </div>
      </div>

      {/* Email — locked */}
      <div className="claim-field">
        <label className="claim-field-label">Email</label>
        <input
          className="claim-field-input"
          type="email"
          value={stubEmail}
          readOnly
          style={{ background: "#F4F4F4", color: "#8b91a3", cursor: "not-allowed" }}
          title="Email address is set by the invite and cannot be changed"
        />
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
          Locked to the invited address
        </p>
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            style={{ paddingRight: 42 }}
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
      </div>

      {/* Agency */}
      <div className="claim-field claim-field-gap">
        <label className="claim-field-label">Agency name</label>
        <input
          className="claim-field-input"
          type="text"
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          required
          autoComplete="organization"
          placeholder="Your estate agency"
        />
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
          {error.includes("already exists") && (
            <>
              {" "}
              <a
                href={`/claim/login?token=${token}`}
                style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}
              >
                Log in instead →
              </a>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || loading}
        className="claim-btn"
        style={{ marginTop: 4 }}
      >
        {loading ? "Creating your account…" : "Create account & claim"}
      </button>

      <p className="claim-form-terms">
        By creating an account you agree to our{" "}
        <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  );
}
