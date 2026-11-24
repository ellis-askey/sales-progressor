"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Gift, CreditCard, Clock, ArrowRight } from "@/components/icons/ph";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { ClaimSaleTypeFields } from "@/components/claim/ClaimSaleTypeFields";
import { ClaimChainLadder, type LadderRow } from "@/components/claim/ClaimChainLadder";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { TrustStrip } from "@/components/ui/TrustStrip";
import { PageTitle } from "@/components/ui/PageTitle";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

// Canonical name tidy: title-case each word but keep all-caps acronyms (BWK, CJ).
const capitalizeWords = titleCaseKeepAcronyms;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  token: string;
  stubEmail: string;
  stubAgencyName: string;
  stubAddress: string;
  ladder: LadderRow[];
  ghostCount: number;
  ghostTopCount?: number;
  originatorName: string;
  originatorAgency: string | null;
  invitedDate: string | null;
};

// Streamlined claim sign-up. Account fields first; once they're all valid the
// sale details (about the sale being claimed) reveal above the button, which
// slides down. "Where is this sale up to?" is captured in-app afterwards
// (ReconcileLaterBanner). See docs/active/chain-invite-conversion.
export function ClaimSignupForm({
  token,
  stubEmail,
  stubAgencyName,
  stubAddress,
  ladder,
  ghostCount,
  ghostTopCount = 0,
  originatorName,
  originatorAgency,
  invitedDate,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(stubEmail);
  const [password, setPassword] = useState("");
  const [firmName, setFirmName] = useState(capitalizeWords(stubAgencyName));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenure, setTenure] = useState<"freehold" | "leasehold" | null>(null);
  const [purchaseType, setPurchaseType] = useState<"mortgage" | "cash_buyer" | "cash_from_proceeds" | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);
  // Once the account is complete the chain folds to just their sale (2026-10-13)
  // — this re-opens it. Resets to folded each time the fields become complete.
  const [chainExpanded, setChainExpanded] = useState(false);

  const emailOk = EMAIL_RE.test(email.trim());
  const otherCount = ladder.filter((r) => r.status !== "you").length + ghostCount + ghostTopCount;
  // Sale details reveal once the account is fully filled in.
  const accountReady =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailOk &&
    password.length >= 10 &&
    firmName.trim().length > 0;
  const canSubmit = accountReady && tenure !== null && purchaseType !== null;

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

    const signInResult = await signIn("credentials", { email: cleanEmail, password, redirect: false });

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
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(`reconcileLater:${transactionId}`, "1"); } catch {}
    }
    await markWelcomeSeenAction().catch(() => {});
    // Full-page navigation (not router.push) so the agent app boots fresh: the
    // ThemeModeBoot script only runs on a real load, so a client-side push would
    // land them in the wrong (dark) theme. See docs/active/chain-invite-conversion.
    window.location.href = `/agent/transactions/${transactionId}?claimed=1&newUser=1`;
  }

  return (
    <div className="claim-signup-grid">
      {/* ── Left — create your account ── */}
      <div className="claim-signup-account">
        <div className="claim-form-card">
          <PageTitle
            title="You're invited to join the chain."
            subtitle="Create your free account to connect your sale and stay updated as the chain progresses."
            style={{ marginBottom: 16 }}
            color="#20242E"
            subtitleColor="#3F3F46"
          />

          {/* Canonical TrustStrip (the benefit strip). */}
          <div className="claim-benefits">
            <TrustStrip
              items={[
                { label: "Free to use", icon: <Gift size={16} weight="regular" /> },
                { label: "No card required", icon: <CreditCard size={16} weight="regular" /> },
                { label: "Less than 60 seconds", icon: <Clock size={16} weight="regular" /> },
              ]}
            />
          </div>

          <form onSubmit={handleSubmit} className="claim-form-tight" style={{ display: "flex", flexDirection: "column", gap: 14, "--lbi-top": "0px" } as React.CSSProperties}>
            {/* Name row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <LabelInput
                label="First name" type="text" name="first-name" autoComplete="given-name" autoCapitalize="words"
                accent={CORAL} fullWidth minBoxWidth={120} required
                value={firstName} onChange={(e) => setFirstName(e.target.value)} onBlur={() => setFirstName((v) => capitalizeWords(v))}
              />
              <LabelInput
                label="Last name" type="text" name="last-name" autoComplete="family-name" autoCapitalize="words"
                accent={CORAL} fullWidth minBoxWidth={120} required
                value={lastName} onChange={(e) => setLastName(e.target.value)} onBlur={() => setLastName((v) => capitalizeWords(v))}
              />
            </div>

            {/* Email — editable, pre-filled from the invite */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <LabelInput
                label="Email" type="email" name="email" autoComplete="email"
                accent={CORAL} fullWidth required
                value={email} onChange={(e) => setEmail(e.target.value)} onBlur={(e) => { if (e.target.value.trim()) setEmail(e.target.value.trim().toLowerCase()); }}
              />
              <p style={{ margin: 0, fontSize: 11, color: "var(--claim-text-3)" }}>
                We&apos;ve filled this in from the invite. Change it if needed.
              </p>
            </div>

            {/* Password — 10-char hint + canonical strength meter, so the rule is
                visible before the Create button can enable (the gate is length >= 10). */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <LabelInput
                field="Password" name="password" autoComplete="new-password"
                accent={CORAL} fullWidth required
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              {password.length > 0 && password.length < 10 && (
                <p style={{ fontSize: 11, color: "#C97D1A", margin: 0 }}>Use at least 10 characters.</p>
              )}
              <PasswordStrength password={password} />
            </div>

            {/* Agency */}
            <LabelInput
              label="Agency name" type="text" name="agency" autoComplete="organization"
              accent={CORAL} fullWidth required
              value={firmName} onChange={(e) => setFirmName(e.target.value)} onBlur={() => setFirmName((v) => capitalizeWords(v))}
            />

            <div className="claim-form-divider" aria-hidden />

            {error && (
              <div className="claim-error">
                {error}
                {error.includes("already exists") && (
                  <>
                    {" "}
                    <a href={`/claim/login?token=${token}`}>Log in instead →</a>
                  </>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!canSubmit} style={{ ...coralVars, width: "100%" }}>
              Create account &amp; join chain <ArrowRight size={17} weight="bold" />
            </Button>

            <p className="claim-form-terms">
              By creating an account you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>.
            </p>
          </form>

          <p className="claim-link-row" style={{ marginTop: 16 }}>
            Already have an account? <a className="claim-login-link" href={`/claim/login?token=${token}`}>Log in instead</a>
          </p>
        </div>
      </div>

      {/* ── Right — the chain you're joining. Once the account fields are
             complete the other sales fold away (click to re-open) and the sale
             details slot into THIS card, so the claimed address isn't repeated
             across a second card (2026-10-13). ── */}
      <div className="claim-signup-side">
        <div className={`claim-panel${accountReady ? " claim-panel--ready" : ""}`}>
          <p className="claim-panel-eyebrow">You&apos;re joining the chain at</p>
          {/* The big address + rule fold away with the other rows (2026-10-13) —
              folded, the eyebrow leads straight into their sale card, which
              already carries the address. */}
          <div className={`claim-panel-head-fold${accountReady && !chainExpanded ? " is-folded" : ""}`}>
            <p className="claim-panel-address">{stubAddress}</p>
            <div className="claim-panel-rule" />
          </div>

          <ClaimChainLadder
            ladder={ladder}
            ghostCount={ghostCount}
            ghostTopCount={ghostTopCount}
            showPill={false}
            chevrons
            othersCollapsed={accountReady && !chainExpanded}
          />

          {accountReady && otherCount > 0 && (
            <button type="button" className="claim-chain-toggle" onClick={() => setChainExpanded((v) => !v)}>
              {chainExpanded
                ? "Hide the other sales"
                : `Show the ${otherCount === 1 ? "other sale" : `${otherCount} other sales`} in this chain`}
            </button>
          )}

          <p className="claim-panel-invite">
            Invited by {originatorName}
            {originatorAgency ? ` · ${originatorAgency}` : ""}
            {invitedDate ? ` · ${invitedDate}` : ""}
          </p>

          <div className={`claim-sale-reveal${accountReady ? " open" : ""}`} aria-hidden={!accountReady}>
            <div className="claim-panel-sale-fields">
              <ClaimSaleTypeFields
                tenure={tenure}
                purchaseType={purchaseType}
                isShareOfFreehold={isShareOfFreehold}
                onTenure={setTenure}
                onPurchaseType={setPurchaseType}
                onShareOfFreehold={setIsShareOfFreehold}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
