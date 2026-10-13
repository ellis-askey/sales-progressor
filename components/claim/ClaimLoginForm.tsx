"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import {
  ReconcileMilestonePicker,
  type MilestoneDefinitionLite,
  type ReconciliationState,
} from "@/components/milestones/ReconcileMilestonePicker";
import { ClaimSaleTypeFields } from "@/components/claim/ClaimSaleTypeFields";
import { ClaimPasswordToggle } from "@/components/claim/ClaimPasswordToggle";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";
import { loginPrecheck } from "@/app/actions/login-precheck";

type Props = {
  token: string;
  stubEmail: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
  // Dev-gallery only: force the authenticator-code stage so /dev/sheets can
  // preview it without a real 2FA account. Never set in production routes.
  initialStage?: "password" | "totp";
};

type ReconciliationMode = "fresh" | "in_progress" | "later";

export function ClaimLoginForm({ token, stubEmail, milestoneDefinitions, initialStage = "password" }: Props) {
  const router = useRouter();
  // Share links carry no invite email — the field is editable then (a locked
  // empty email could never sign in). Emailed invites keep it locked.
  const emailLocked = !!stubEmail;
  const [email, setEmail] = useState(stubEmail);
  const [password, setPassword] = useState("");
  // Two-step verification (claim-login parity, 2026-10-13): same staged flow as
  // the main login — password first, then the authenticator code only when the
  // account has 2FA on. authorize() still enforces the code server-side.
  const [stage, setStage] = useState<"password" | "totp">(initialStage);
  const [totp, setTotp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenure, setTenure] = useState<"freehold" | "leasehold" | null>(null);
  const [purchaseType, setPurchaseType] = useState<"mortgage" | "cash_buyer" | "cash_from_proceeds" | null>(null);
  const [isShareOfFreehold, setIsShareOfFreehold] = useState(false);
  const [reconciliationMode, setReconciliationMode] = useState<ReconciliationMode | null>(null);
  const [reconciledMilestones, setReconciledMilestones] = useState<ReconciliationState>({});
  const [wizardStep, setWizardStep] = useState<"vendor" | "purchaser">("vendor");

  const onPurchaserStep = reconciliationMode !== "in_progress" || wizardStep === "purchaser";
  const saleReady =
    tenure !== null &&
    purchaseType !== null &&
    reconciliationMode !== null &&
    onPurchaserStep;
  const canSubmit =
    saleReady &&
    (stage === "totp"
      ? totp.trim().length > 0
      : email.trim().length > 0 && password.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    if (stage === "totp") {
      await completeSignInAndClaim(totp.trim());
      return;
    }

    // Password checked first (rate-limited, server-side) so the code step only
    // appears for accounts that actually have two-step verification on.
    const pre = await loginPrecheck({ email: email.trim(), password });
    if (!pre.ok) {
      setLoading(false);
      setError("Incorrect email or password.");
      return;
    }
    if (pre.needs2fa) {
      setLoading(false);
      setStage("totp");
      return;
    }
    await completeSignInAndClaim();
  }

  async function completeSignInAndClaim(code?: string) {
    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      totp: code ?? "",
      redirect: false,
    });

    if (result?.error || !result?.ok) {
      setLoading(false);
      setError(
        code !== undefined
          ? "That code isn't right. Try again, or use a backup code."
          : "Incorrect email or password.",
      );
      return;
    }

    const claimBody: Record<string, unknown> = {
      token,
      action: "create",
      tenure,
      purchaseType,
      isShareOfFreehold,
      reconciliationMode,
    };
    if (reconciliationMode === "in_progress") {
      claimBody.reconciledMilestones = Object.entries(reconciledMilestones)
        .filter(([, v]) => v.ticked)
        .map(([milestoneDefinitionId, v]) => ({
          milestoneDefinitionId,
          eventDate: v.eventDate || null,
        }));
    }

    const claimRes = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(claimBody),
    });

    if (!claimRes.ok) {
      const data = await claimRes.json().catch(() => ({}));
      setLoading(false);
      setError((data as { error?: string }).error ?? "Couldn't link your sale. Try again, or contact support if it keeps happening.");
      return;
    }

    const { transactionId } = (await claimRes.json()) as { transactionId: string };
    if (reconciliationMode === "later" && typeof window !== "undefined") {
      try { window.localStorage.setItem(`reconcileLater:${transactionId}`, "1"); } catch {}
    }
    await markWelcomeSeenAction().catch(() => {});
    router.push(`/agent/transactions/${transactionId}?claimed=1`);
  }

  const isWizardActive = reconciliationMode === "in_progress";
  const allUpperFilled = tenure !== null && purchaseType !== null;
  const upperSummary = allUpperFilled
    ? `${tenure === "leasehold" ? (isShareOfFreehold ? "Leasehold (share of freehold)" : "Leasehold") : "Freehold"} · ${purchaseType === "mortgage" ? "Mortgaged purchase" : purchaseType === "cash_buyer" ? "Cash purchase" : "Cash from proceeds"}`
    : "";

  return (
    // Two cards (2026-10-13): the account on the left, the sale set-up on the
    // right — side by side on desktop, stacked on mobile/tablet. One form wraps
    // both so submit sees every field.
    <form onSubmit={handleSubmit} className="claim-login-grid">
      {/* ── Left — log in ── */}
      <div className="claim-form-card">
        <h1 className="claim-sub-h1">Log in to claim</h1>
        <p className="claim-sub-p">
          {emailLocked
            ? <>There&apos;s already an account for <strong>{stubEmail}</strong>. Log in to link your sale.</>
            : <>Log in to your account and we&apos;ll link this sale to it.</>}
        </p>

        {stage === "password" && (
          <>
            {/* Agents who sign in with Google / Microsoft have no password —
                these carry them through OAuth and back to the claim confirm
                page, which completes the claim (parity with the main login,
                2026-10-13). */}
            <div className="claim-oauth-row">
              <button
                type="button"
                className="claim-oauth-btn"
                disabled={loading}
                onClick={() => signIn("google", { callbackUrl: `/claim/confirm?token=${token}` })}
                aria-label="Continue with Google"
              >
                <GoogleIcon /> Continue with Google
              </button>
              <button
                type="button"
                className="claim-oauth-btn"
                disabled={loading}
                onClick={() => signIn("azure-ad", { callbackUrl: `/claim/confirm?token=${token}` })}
                aria-label="Continue with Microsoft"
              >
                <MicrosoftIcon /> Continue with Microsoft
              </button>
            </div>
            <div className="claim-oauth-divider"><span>or log in with email</span></div>

            {/* Email — locked when the invite carried one; editable on share links */}
            <div className="claim-field" style={{ marginBottom: 14 }}>
              <label className="claim-field-label">Email</label>
              <input
                className="claim-field-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) setEmail(e.target.value.trim().toLowerCase()); }}
                readOnly={emailLocked}
                required
                autoComplete="email"
                placeholder="you@youragency.co.uk"
                style={emailLocked ? { color: "var(--claim-text-3)", cursor: "not-allowed" } : undefined}
                title={emailLocked ? "Email address is set by the invite" : undefined}
              />
            </div>

            {/* Password */}
            <div className="claim-field">
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
                <ClaimPasswordToggle shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
              </div>
              <p className="claim-forgot-row">
                <a href="/forgot-password">Forgot password?</a>
              </p>
            </div>
          </>
        )}

        {stage === "totp" && (
          <div className="claim-field">
            <label className="claim-field-label">Authenticator code</label>
            <input
              className="claim-field-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              autoFocus
              placeholder="123 456"
            />
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--claim-text-3)", lineHeight: 1.5 }}>
              Enter the 6-digit code from your authenticator app, or one of your backup codes.
            </p>
            <button
              type="button"
              className="claim-totp-back"
              onClick={() => { setStage("password"); setTotp(""); setError(null); }}
            >
              ← Back
            </button>
          </div>
        )}

        {error && <div className="claim-error" style={{ marginTop: 14 }}>{error}</div>}

        {onPurchaserStep && (
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="claim-btn"
            style={{ marginTop: 18 }}
          >
            {loading ? "Signing in…" : stage === "totp" ? "Verify & claim" : "Log in & claim"}
          </button>
        )}

        <p className="claim-link-row" style={{ marginTop: 16 }}>
          New agent?{" "}
          <a className="claim-login-link" href={`/claim/signup?token=${token}`}>Create an account instead</a>
        </p>
      </div>

      {/* ── Right — the sale set-up ── */}
      <div className="claim-form-card">
        {/* Combined summary pill — shown when the milestone wizard is active */}
        {isWizardActive && allUpperFilled && (
          <button
            type="button"
            className="claim-sale-details-summary"
            onClick={() => { setReconciliationMode(null); setWizardStep("vendor"); }}
            aria-label="Edit your details"
          >
            <span>{upperSummary}</span>
            <span className="claim-sale-details-summary-edit">Edit</span>
          </button>
        )}

        <div className={`claim-collapsible${isWizardActive ? " collapsed" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="claim-sale-details">
            <p className="claim-sale-details-note">Two details to set up your file.</p>
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

        {/* Reconciliation picker — only after tenure + purchaseType selected */}
        {tenure && purchaseType && (
          <div className="claim-reconcile" style={{ marginTop: 16 }}>
            <p className="claim-field-label">Where is this sale up to?</p>
            <button type="button" className={`claim-reconcile-option${reconciliationMode === "fresh" ? " on" : ""}`} onClick={() => setReconciliationMode("fresh")}>
              <span className="claim-reconcile-option-title">Just starting</span>
              <span className="claim-reconcile-option-sub">No work done yet, start with a clean file</span>
            </button>
            <button type="button" className={`claim-reconcile-option${reconciliationMode === "in_progress" ? " on" : ""}`} onClick={() => setReconciliationMode("in_progress")}>
              <span className="claim-reconcile-option-title">Already in progress</span>
              <span className="claim-reconcile-option-sub">Tick what&apos;s already done. Add real-world dates if you know them, leave blank if not.</span>
            </button>
            <button type="button" className={`claim-reconcile-option${reconciliationMode === "later" ? " on" : ""}`} onClick={() => setReconciliationMode("later")}>
              <span className="claim-reconcile-option-title">I&apos;ll set this up later</span>
              <span className="claim-reconcile-option-sub">Claim now, mark completed milestones from the file page</span>
            </button>
            {reconciliationMode === "in_progress" && (
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
        )}
      </div>
    </form>
  );
}
