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

type Props = {
  token: string;
  stubEmail: string;
  milestoneDefinitions: MilestoneDefinitionLite[];
};

type ReconciliationMode = "fresh" | "in_progress" | "later";

export function ClaimLoginForm({ token, stubEmail, milestoneDefinitions }: Props) {
  const router = useRouter();
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
      email: stubEmail,
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
    ? `${stubEmail} · ${tenure === "leasehold" ? (isShareOfFreehold ? "Leasehold (share of freehold)" : "Leasehold") : "Freehold"} · ${purchaseType === "mortgage" ? "Mortgage" : purchaseType === "cash_buyer" ? "Cash purchase" : "Cash from Proceeds"}`
    : "";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Combined summary pill — shown when wizard is active */}
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

      {/* Collapsible upper form — email + password + sale details */}
      <div className={`claim-collapsible${isWizardActive ? " collapsed" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
      </div>{/* /.claim-collapsible */}

      {/* Reconciliation picker — only after tenure + purchaseType selected */}
      {tenure && purchaseType && (
        <div className="claim-reconcile">
          <p className="claim-field-label">Where is this sale up to?</p>
          <button type="button" className={`claim-reconcile-option${reconciliationMode === "fresh" ? " on" : ""}`} onClick={() => setReconciliationMode("fresh")}>
            <span className="claim-reconcile-option-title">Just starting</span>
            <span className="claim-reconcile-option-sub">No work done yet — start with a clean file</span>
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

      {onPurchaserStep && (
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="claim-btn"
          style={{ marginTop: 4 }}
        >
          {loading ? "Signing in…" : "Log in & claim"}
        </button>
      )}
    </form>
  );
}
