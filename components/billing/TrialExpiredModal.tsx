"use client";

// components/billing/TrialExpiredModal.tsx
//
// Multi-step modal shown when a director needs to add a card on file
// because their agency's 14-day trial has elapsed.
//
// Four steps:
//   1. "intro"   ("Your free trial has ended" copy + reassurance + CTA)
//   2. "terms"   (pricing terms in our styling, Accept advances to card)
//   3. "card"    (embedded CardCaptureForm, Stripe Elements)
//   4. "success" (green checkmark, "You're all set", source-aware exit)
//
// The "terms" step is the same gate the standalone settings page uses
// via RedesignedDisclosure: the server-side SetupIntent endpoint refuses
// to issue a clientSecret until PricingAcknowledgement exists for the
// active TermsVersion. If the agency has already acknowledged (props
// pre-resolved on the server) the step is skipped entirely.
//
// Source-aware behaviour:
//   source="new-sale" (rendered on /agent/transactions/new as the page
//   guard). Modal is unclosable; success step pauses ~1.8s then
//   router.refresh() so the page re-runs its server check and renders
//   NewSaleFlow (since stripeCustomerId is now set).
//
//   source="hub" (rendered by TrialBannerWithModal from the hub banner).
//   Modal opens directly on the first useful step (terms if not yet
//   acknowledged, else card). Success step auto-dismisses after ~2.5s
//   with a Close button as escape hatch. On dismiss: router.refresh()
//   so the banner re-checks agency state and disappears.
//
// Motion uses canonical .agent-modal + .agent-backdrop-overlay classes
// (fade + scale entrance, 250ms ease, reduced-motion at CSS layer) and
// .agent-reveal-in on the step container so each step transition replays.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CardCaptureForm } from "./CardCaptureForm";
import type { TermsSection } from "@/lib/billing/terms-sections";

type Step = "intro" | "terms" | "card" | "success";

type Props = {
  publishableKey: string;
  source: "new-sale" | "hub";
  // Required when source is "hub" (gives the user a way to dismiss the
  // modal). Ignored when source is "new-sale" (the modal is the page
  // guard, the only way out is to add a card or back-button to the hub).
  onClose?: () => void;
  // Pre-resolved pricing-terms state (server-fetched at the caller).
  // When termsAcknowledged is true the terms step is skipped entirely.
  // When termsVersionId is null (no active TermsVersion configured)
  // the modal also skips the terms step and lets CardCaptureForm
  // surface the server-config error from /api/billing/setup-intent.
  termsAcknowledged: boolean;
  termsVersionId: string | null;
  termsVersionTag: string | null;
  termsSections: TermsSection[];
};

export function TrialExpiredModal({
  publishableKey,
  source,
  onClose,
  termsAcknowledged,
  termsVersionId,
  termsVersionTag,
  termsSections,
}: Props) {
  const needsTerms = !termsAcknowledged && termsVersionId !== null;
  // Hub clicks already conveyed "I want to add a card" via the banner
  // button: skip the trial-explanation intro and open on the first
  // genuinely actionable step (terms if needed, else card).
  // New-sale clicks start on the intro because the director hasn't yet
  // seen the trial-ended context.
  const initialStep: Step =
    source === "hub" ? (needsTerms ? "terms" : "card") : "intro";
  const [step, setStep] = useState<Step>(initialStep);
  const router = useRouter();

  // Auto-exit timer for the success step.
  useEffect(() => {
    if (step !== "success") return;
    const delay = source === "new-sale" ? 1800 : 2500;
    const timer = setTimeout(() => {
      if (source === "new-sale") {
        // Page guard re-evaluates on refresh; stripeCustomerId is now set
        // so the guard returns false and NewSaleFlow takes over.
        router.refresh();
      } else if (onClose) {
        onClose();
        // Hub banner re-checks agency state on refresh; it'll return null
        // now that stripeCustomerId is set.
        router.refresh();
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [step, source, onClose, router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-expired-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Backdrop: dim + blur, fades in via .agent-backdrop-overlay */}
      <div className="fixed inset-0 agent-backdrop-overlay" aria-hidden />

      <div
        className="agent-modal"
        style={{
          maxWidth: 480,
          width: "calc(100vw - 48px)",
          position: "relative",
          padding: 32,
        }}
      >
        {/* Step container is keyed on the step name so React remounts
            the children on each transition. .agent-reveal-in replays
            the 150ms ease-out fade on every remount. */}
        <div key={step} className="agent-reveal-in">
          {step === "intro" && (
            <IntroStep
              onContinue={() => setStep(needsTerms ? "terms" : "card")}
            />
          )}
          {step === "terms" && termsVersionId && termsVersionTag && (
            <TermsStep
              versionId={termsVersionId}
              versionTag={termsVersionTag}
              sections={termsSections}
              onAccept={() => setStep("card")}
              onDecline={
                source === "hub" && onClose
                  ? onClose
                  : () => setStep("intro")
              }
              declineLabel={source === "hub" ? "Cancel" : "Back"}
            />
          )}
          {step === "card" && (
            <CardStep
              publishableKey={publishableKey}
              source={source}
              onBack={
                source === "new-sale"
                  ? () => setStep(needsTerms ? "terms" : "intro")
                  : undefined
              }
              onCancel={source === "hub" && onClose ? onClose : undefined}
              onSaved={() => setStep("success")}
            />
          )}
          {step === "success" && (
            <SuccessStep
              source={source}
              onClose={source === "hub" && onClose ? () => {
                onClose();
                router.refresh();
              } : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step: terms ─────────────────────────────────────────────────────────
// Same gate as RedesignedDisclosure on /agent/account/billing: presents
// the active TermsVersion's parsed sections, requires the director to
// click Accept (records a PricingAcknowledgement row via the same
// /api/billing/acknowledge endpoint), then advances to the card step.
// Smaller body sizes than the settings-page surface so the modal feels
// proportional (~12.5 vs 13.5).

function TermsStep({
  versionId,
  versionTag,
  sections,
  onAccept,
  onDecline,
  declineLabel,
}: {
  versionId: string;
  versionTag: string;
  sections: TermsSection[];
  onAccept: () => void;
  onDecline: () => void;
  declineLabel: string;
}) {
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/acknowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termsVersionId: versionId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Couldn't record acknowledgement. Try again.");
          return;
        }
        onAccept();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
        Before we add your card
      </h2>
      <p style={{ margin: "4px 0 16px", fontSize: 11, color: "#9ca3af", letterSpacing: 0.2 }}>
        Pricing terms <code style={{ fontSize: 11, color: "#9ca3af" }}>{versionTag}</code>
      </p>

      {/* Scrollable terms body. Smaller fonts than the settings-page
          surface so the modal feels proportional. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: 260,
          overflowY: "auto",
          padding: "14px 16px",
          background: "rgba(0,0,0,0.025)",
          border: "0.5px solid rgba(0,0,0,0.06)",
          borderRadius: 8,
        }}
      >
        {sections.map((s, i) => (
          <section key={i}>
            <h3 style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {s.heading}
            </h3>
            <p style={{ margin: 0, fontSize: 12.5, color: "#4b5563", lineHeight: 1.55 }}>
              {s.body}
            </p>
          </section>
        ))}
      </div>

      {error && (
        <div
          className="agent-reveal-in"
          style={{
            marginTop: 14,
            padding: "9px 12px",
            fontSize: 12.5,
            color: "#991b1b",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        <button
          type="button"
          onClick={onDecline}
          disabled={submitting}
          className="agent-btn agent-btn-secondary agent-btn-md"
          style={{ flex: "0 0 auto" }}
        >
          {declineLabel}
        </button>
        <button
          type="button"
          onClick={handleAccept}
          disabled={submitting}
          className="agent-btn agent-btn-primary agent-btn-md"
          style={{ flex: 1 }}
        >
          {submitting ? "Confirming…" : "Accept and continue"}
        </button>
      </div>
    </>
  );
}

// ─── Step 1: intro ───────────────────────────────────────────────────────

function IntroStep({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(255,107,74,0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
        aria-hidden
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--agent-coral)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2.5" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="6" y1="15" x2="9" y2="15" />
        </svg>
      </div>

      <h2
        id="trial-expired-title"
        style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}
      >
        Your free trial has ended
      </h2>

      <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6, color: "#4b5563" }}>
        Your two-week trial has flown by. The sales you added during it keep running, free through to exchange, just as promised. To add new ones, add a card.
      </p>

      <div
        style={{
          margin: "20px 0 0",
          padding: "12px 14px",
          background: "rgba(255,107,74,0.06)",
          border: "0.5px solid rgba(255,107,74,0.25)",
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.5,
          color: "#7f1d1d",
        }}
      >
        <strong style={{ color: "var(--agent-coral)" }}>Nothing&apos;s charged today.</strong>{" "}
        New sales are only billed when they exchange, never when you add one, and never if it falls through.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>
        <button
          type="button"
          onClick={onContinue}
          className="agent-btn agent-btn-primary agent-btn-lg"
        >
          Add a card to continue
        </button>
        <a
          href="/agent/hub"
          className="agent-btn agent-btn-secondary agent-btn-lg"
          style={{ textDecoration: "none" }}
        >
          Back to dashboard
        </a>
      </div>
    </>
  );
}

// ─── Step 2: card ────────────────────────────────────────────────────────

function CardStep({
  publishableKey,
  source,
  onBack,
  onCancel,
  onSaved,
}: {
  publishableKey: string;
  source: "new-sale" | "hub";
  onBack?: () => void;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  return (
    <>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
        Add your card
      </h2>
      <p style={{ margin: "8px 0 20px", fontSize: 13, lineHeight: 1.55, color: "#6b7280" }}>
        We&apos;ll only charge it when a sale exchanges. Saved securely with Stripe.
      </p>

      <CardCaptureForm publishableKey={publishableKey} onSuccess={onSaved} />

      {/* Secondary action: back to intro (new-sale) or cancel (hub) */}
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        {source === "new-sale" && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="agent-btn agent-btn-ghost agent-btn-sm"
          >
            ← Back
          </button>
        )}
        {source === "hub" && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="agent-btn agent-btn-ghost agent-btn-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );
}

// ─── Step 3: success ─────────────────────────────────────────────────────

function SuccessStep({
  source,
  onClose,
}: {
  source: "new-sale" | "hub";
  onClose?: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "8px 0" }}>
      {/* Green checkmark in a chip, popped in via .ms-pop (same vocab
          as the sale-confirmation pops elsewhere in the app). */}
      <div
        className="ms-pop"
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: "rgba(16,185,129,0.12)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
        aria-hidden
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
        You&apos;re all set
      </h2>
      <p style={{ margin: "10px auto 0", fontSize: 14, lineHeight: 1.55, color: "#4b5563", maxWidth: 360 }}>
        {source === "new-sale"
          ? "Taking you to the new sale form…"
          : <>Your card is saved. We&apos;ll only charge it when a sale exchanges.</>}
      </p>

      {/* Close button only on hub source: gives manual escape from the
          auto-dismiss. New-sale source has no close (router.refresh
          handles the exit). */}
      {source === "hub" && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="agent-btn agent-btn-secondary agent-btn-md"
          style={{ marginTop: 24 }}
        >
          Close
        </button>
      )}
    </div>
  );
}
