// /agent/settings/billing — placeholder for the owner's business billing.
//
// Founder decision (2026-10-03): keep Billing visible (nav tab + main-menu item)
// but show an honest empty state — what a progression business ↔ TSP billing view
// should contain is still to be designed (tracked in EXTERNAL_SP_BACKLOG P2).
// This is a real empty state with real copy, not a dead/disabled control.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Receipt } from "@phosphor-icons/react/dist/ssr";

export default async function BusinessBillingPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  return (
    <>
      <AccountPageHeader
        title="Billing"
        subtitle="Your invoices and payment details for your business."
      />
      <AccountCard>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "28px 20px" }}>
          <span
            aria-hidden
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 52, height: 52, borderRadius: 14,
              background: "rgba(255,107,74,0.10)", color: "var(--agent-coral-deep, #E2452A)",
            }}
          >
            <Receipt size={26} weight="bold" />
          </span>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
            Nothing to see here yet
          </h2>
          <p style={{ margin: 0, maxWidth: 420, fontSize: 13.5, lineHeight: 1.6, color: "#6b7280" }}>
            When billing for your business is ready, your invoices and payment details will live here. There&rsquo;s nothing you need to do for now.
          </p>
        </div>
      </AccountCard>
    </>
  );
}
