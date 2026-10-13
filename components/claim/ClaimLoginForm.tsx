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

type Props = {
  token: string;
  stubEmail: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
};

type ReconciliationMode = "fresh" | "in_progress" | "later";

export function ClaimLoginForm({ token, stubEmail, milestoneDefinitions }: Props) {
  const router = useRouter();
  // Share links carry no invite email — the field is editable then (a locked
  // empty email could never sign in). Emailed invites keep it locked.
  const emailLocked = !!stubEmail;
  const [email, setEmail] = useState(stubEmail);
  const [password, setPassword] = useState("");
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
  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    tenure !== null &&
    purchaseType !== null &&
    reconciliationMode !== null &&
    onPurchaserStep;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.error || !result?.ok) {
      setLoading(false);
      setError("Incorrect password. Please try again.");
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

        {error && <div className="claim-error" style={{ marginTop: 14 }}>{error}</div>}

        {onPurchaserStep && (
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="claim-btn"
            style={{ marginTop: 18 }}
          >
            {loading ? "Signing in…" : "Log in & claim"}
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
