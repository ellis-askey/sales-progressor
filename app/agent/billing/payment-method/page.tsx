// app/agent/billing/payment-method/page.tsx
//
// Director-only payment-method page. Server component picks the render
// state via lib/billing/payment-method-state.ts; UI follows.
//
// State machine (in checked order, see payment-method-state.ts):
//   - stripe_not_configured → blocked: env vars missing (founder action)
//   - pending → blocked: TermsVersion table empty, terms copy from Ellis
//   - disclosure → render PricingDisclosure (body comes from TermsVersion.body)
//   - card_form → render CardCaptureForm (Stripe Elements)
//
// No disclosure text in code. No placeholder TermsVersion row seeded
// anywhere — empty table is the genuine PR 6 ship state.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { getPaymentMethodState } from "@/lib/billing/payment-method-state";
import { PricingDisclosure } from "@/components/billing/PricingDisclosure";
import { CardCaptureForm } from "@/components/billing/CardCaptureForm";

function BlockedNotice({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: "var(--agent-card-bg, white)",
        border: "1px solid var(--agent-border, #e5e7eb)",
        borderRadius: 12,
        padding: 24,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h2>
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--agent-text-secondary, #6b7280)", lineHeight: 1.5 }}>
        {body}
      </p>
    </div>
  );
}

export default async function PaymentMethodPage() {
  const session = await requireSession();
  if (session.user.role !== "director") notFound();
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  const state = await getPaymentMethodState(agencyId);

  return (
    <>
      <PageHeader
        title="Payment method"
        subtitle="Card on file for monthly billing"
      />

      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        {state.kind === "stripe_not_configured" && (
          <BlockedNotice
            title="Payment setup is temporarily unavailable"
            body="Our payment provider isn't configured for this environment yet. If this persists, contact support@thesalesprogressor.co.uk."
          />
        )}

        {state.kind === "pending" && (
          <BlockedNotice
            title="Payment setup is not yet available"
            body="Pricing disclosure is being finalised. Card capture will be enabled once the terms are published."
          />
        )}

        {state.kind === "disclosure" && (
          <PricingDisclosure
            termsVersionId={state.terms.id}
            termsBody={state.terms.body}
            termsVersionTag={state.terms.versionTag}
          />
        )}

        {state.kind === "card_form" && (
          <>
            <div
              style={{
                background: "var(--agent-card-bg, white)",
                border: "1px solid var(--agent-border, #e5e7eb)",
                borderRadius: 12,
                padding: 24,
              }}
            >
              <CardCaptureForm publishableKey={process.env.STRIPE_PUBLISHABLE_KEY ?? ""} />
            </div>
            <p style={{ fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
              Pricing terms acknowledged: <code>{state.terms.versionTag}</code>
            </p>
          </>
        )}
      </div>
    </>
  );
}
