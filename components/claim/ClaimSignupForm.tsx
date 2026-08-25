"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import { displayChainPosition } from "@/lib/chain/positions";

function toTitleCase(str: string): string {
  return str.trim().replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PanelLink = {
  id: string;
  position: number;
  transactionId: string | null;
  stubPropertyAddress: string | null;
  claimedFirmName: string | null;
  transactionAddress: string | null;
};

type Props = {
  token: string;
  stubEmail: string;
  stubAgencyName: string;
  stubAddress: string;
  ownLinkId: string;
  chainLinksCount: number;
  panelLinks: PanelLink[];
  panelGhostCount: number;
  originatorName: string;
  originatorAgency: string | null;
  invitedDate: string | null;
};

// Streamlined claim sign-up (Phase 1, revised). Left column creates the account;
// the sale details (tenure + purchase type) live in their own card on the right,
// under the chain panel, so it's clear they describe THE SALE being claimed, not
// the account. The whole thing is one client component so the right-column pills
// update the same state the left-column form submits. "Where is this sale up to?"
// is captured in-app afterwards (ReconcileLaterBanner). See docs/active/chain-invite-conversion.
export function ClaimSignupForm({
  token,
  stubEmail,
  stubAgencyName,
  stubAddress,
  ownLinkId,
  chainLinksCount,
  panelLinks,
  panelGhostCount,
  originatorName,
  originatorAgency,
  invitedDate,
}: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(stubEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firmName, setFirmName] = useState(toTitleCase(stubAgencyName));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenure, setTenure] = useState<"freehold" | "leasehold" | null>(null);
  const [purchaseType, setPurchaseType] = useState<"mortgage" | "cash_buyer" | "cash_from_proceeds" | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailOk &&
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
    const cleanEmail = email.trim().toLowerCase();

    const registerRes = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: cleanEmail, password, firmName: firmName.trim(), role: "director", claimSignup: true }),
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
      email: cleanEmail,
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
    // Every new claim lands on the file with the dismissable "Bring this file up to
    // date" banner, so catching up on existing progress happens in-app.
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`reconcileLater:${transactionId}`, "1"); } catch {}
    }
    await markWelcomeSeenAction().catch(() => {});
    router.push(`/agent/transactions/${transactionId}?claimed=1&newUser=1`);
  }

  return (
    <div className="claim-signup-grid">
      {/* ── Left — create your account ── */}
      <div className="claim-signup-account">
        <div className="claim-form-card">
          <h1 className="claim-sub-h1">Create your account</h1>
          <p className="claim-sub-p">Free 14-day trial · No card needed · Cancel anytime.</p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Name row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="claim-field">
                <label className="claim-field-label">First name</label>
                <input className="claim-field-input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" placeholder="Jane" />
              </div>
              <div className="claim-field">
                <label className="claim-field-label">Last name</label>
                <input className="claim-field-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" placeholder="Smith" />
              </div>
            </div>

            {/* Email — editable, pre-filled from the invite */}
            <div className="claim-field">
              <label className="claim-field-label">Email</label>
              <input className="claim-field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@youragency.co.uk" />
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
                Pre-filled from the invite. Change it if it isn&apos;t yours.
              </p>
            </div>

            {/* Password */}
            <div className="claim-field claim-field-gap">
              <label className="claim-field-label">Password</label>
              <div className="claim-field-row">
                <input className="claim-field-input" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" placeholder="At least 8 characters" style={{ paddingRight: 42 }} />
                <button type="button" className="claim-field-toggle" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Agency */}
            <div className="claim-field claim-field-gap">
              <label className="claim-field-label">Agency name</label>
              <input className="claim-field-input" type="text" value={firmName} onChange={(e) => setFirmName(e.target.value)} required autoComplete="organization" placeholder="Your estate agency" />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
                {error}
                {error.includes("already exists") && (
                  <>
                    {" "}
                    <a href={`/claim/login?token=${token}`} style={{ color: "#FF6B4A", fontWeight: 600, textDecoration: "none" }}>
                      Log in instead →
                    </a>
                  </>
                )}
              </div>
            )}

            <button type="submit" disabled={!canSubmit || loading} className="claim-btn" style={{ marginTop: 4 }}>
              {loading ? "Creating your account…" : "Create account & claim"}
            </button>

            <p className="claim-form-terms">
              By creating an account you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
            </p>
          </form>

          <p className="claim-link-row" style={{ marginTop: 16 }}>
            Already have an account? <a href={`/claim/login?token=${token}`}>Log in instead</a>
          </p>
        </div>
      </div>

      {/* ── Right — the chain you're joining + this sale's details ── */}
      <div className="claim-signup-side">
        <div className="claim-panel">
          <p className="claim-panel-eyebrow">You&apos;re joining the chain at</p>
          <p className="claim-panel-address">{stubAddress}</p>
          <div className="claim-panel-rule" />

          <div className="claim-chain">
            {panelLinks.map((cl, i) => {
              const isYours = cl.id === ownLinkId;
              const isClaimed = cl.transactionId !== null;
              const address = isClaimed ? (cl.transactionAddress ?? "") : isYours ? (stubAddress ?? "") : "";
              const agency = cl.claimedFirmName ?? null;
              return (
                <div key={cl.id}>
                  {i > 0 && (
                    <div className="claim-chain-connector">
                      <div className="claim-chain-connector-dot" />
                      <div className="claim-chain-connector-line" />
                      <div className="claim-chain-connector-dot" />
                    </div>
                  )}
                  <div className="claim-chain-row">
                    <div className="claim-chain-gutter">
                      <span className="claim-chain-num">{String(displayChainPosition(cl.position, chainLinksCount)).padStart(2, "0")}</span>
                    </div>
                    <div className={`claim-chain-card ${isYours ? "claim-chain-card--yours" : isClaimed ? "claim-chain-card--claimed" : "claim-chain-card--pending"}`}>
                      {isYours ? (
                        <>
                          <div className="claim-chain-head">
                            <span className="claim-chain-address">{address || "Your sale"}</span>
                            <span className="claim-chain-status">YOU</span>
                          </div>
                          <div className="claim-chain-inner">
                            <span className="claim-chain-inner-text">Your sale</span>
                          </div>
                        </>
                      ) : isClaimed ? (
                        <>
                          <div className="claim-chain-head">
                            <span className="claim-chain-address">{address}</span>
                            <span className="claim-chain-status">✓</span>
                          </div>
                          {agency && <div className="claim-chain-agency">{agency}</div>}
                        </>
                      ) : (
                        <div className="claim-chain-head">
                          <span className="claim-chain-address" style={{ color: "rgba(255,255,255,.5)", fontStyle: "italic", fontWeight: 400 }}>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {panelGhostCount > 0 && (
              <>
                <div className="claim-chain-connector">
                  <div className="claim-chain-connector-dot" />
                  <div className="claim-chain-connector-line" />
                  <div className="claim-chain-connector-dot" />
                </div>
                <div className="claim-chain-row">
                  <div className="claim-chain-gutter">
                    <span className="claim-chain-num" style={{ fontSize: 14, opacity: 0.5 }}>··</span>
                  </div>
                  <div className="claim-chain-card claim-chain-card--ghost">
                    <span className="claim-chain-address" style={{ color: "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 400 }}>and {panelGhostCount} more</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="claim-panel-invite">
            Invited by {originatorName}
            {originatorAgency ? ` · ${originatorAgency}` : ""}
            {invitedDate ? ` · ${invitedDate}` : ""}
          </p>
        </div>

        {/* Sale details — about the sale being claimed, not the account */}
        <div className="claim-sale-card">
          <p className="claim-sale-card-eyebrow">About your sale</p>
          <p className="claim-sale-card-address">{stubAddress}</p>
          <p className="claim-sale-card-note">Two quick details so we set up the right steps for this sale.</p>

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
              <button type="button" className={`claim-segment-pill${purchaseType === "cash_from_proceeds" ? " on" : ""}`} onClick={() => setPurchaseType("cash_from_proceeds")}>Cash from Proceeds</button>
            </div>
          </div>
          {tenure === "leasehold" && (
            <label className="claim-share-of-freehold">
              <input type="checkbox" checked={isShareOfFreehold} onChange={(e) => setIsShareOfFreehold(e.target.checked)} />
              Share of freehold
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
