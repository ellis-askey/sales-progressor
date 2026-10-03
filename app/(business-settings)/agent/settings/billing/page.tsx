// /agent/settings/billing — what the progression business pays TSP for the
// platform: £59 base + £39 per extra team member + £5 per completed sale.
//
// DARK by design (founder, 2026-10-03): this shows the bill but no money is taken
// yet — collection (the Stripe subscription + charging) lands behind a billing
// switch, exactly like the agency billing. The copy makes that clear so a pilot
// owner isn't surprised. Owner-gated.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { progressionBusinessesEnabled, progressionBillingCollectEnabled } from "@/lib/progression/flags";
import { resolveBusinessOwner } from "@/lib/services/progression-clients";
import { getBusinessBillingSummary } from "@/lib/progression/business-billing";
import { fmtCurrencyPence } from "@/lib/utils";
import { AccountPageHeader } from "@/components/account/chrome/AccountPageHeader";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Receipt } from "@phosphor-icons/react/dist/ssr";

export default async function BusinessBillingPage() {
  if (!progressionBusinessesEnabled()) notFound();
  const session = await requireSession();
  const owner = await resolveBusinessOwner(session);
  if (!owner) notFound();

  const s = await getBusinessBillingSummary(owner.businessId);
  const month = s.monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const collecting = progressionBillingCollectEnabled();

  return (
    <>
      <AccountPageHeader
        title="Billing"
        subtitle="What your business pays for using Sales Progressor."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Not-live notice */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 16px", borderRadius: 13,
          background: "rgba(37,99,235,0.06)", border: "0.5px solid rgba(37,99,235,0.2)",
        }}>
          <span aria-hidden style={{ color: "var(--agent-info, #2563eb)", flexShrink: 0, marginTop: 1, fontWeight: 800 }}>i</span>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
            {collecting
              ? <>Your plan is live. We charge the card on file each month for your subscription and completed sales.</>
              : <>This is what your plan works out to. <strong>We&rsquo;re not taking any payment yet.</strong> We&rsquo;ll let you know and ask for a card before billing goes live.</>}
          </p>
        </div>

        <AccountCard
          icon={<Receipt size={18} weight="bold" />}
          title={`This month · ${month}`}
          subtitle="£59 for you, £39 per team member, and £5 per completed sale."
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {s.lines.map((line, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                padding: "11px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--agent-border-subtle)",
              }}>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {line.description}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {fmtCurrencyPence(line.amountPence)}
                </span>
              </div>
            ))}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              padding: "13px 0 2px", marginTop: 4, borderTop: "1px solid var(--agent-border-default, rgba(0,0,0,0.12))",
            }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                Total this month
              </span>
              <span style={{ fontSize: 17, fontWeight: 820, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
                {fmtCurrencyPence(s.totalPence)}
              </span>
            </div>
          </div>
          <p style={{ margin: "14px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
            {s.saleCount === 0
              ? "No completed sales yet this month. Sales are added here as they exchange."
              : `${s.saleCount} completed ${s.saleCount === 1 ? "sale" : "sales"} this month at £5 each.`}
          </p>
        </AccountCard>
      </div>
    </>
  );
}
