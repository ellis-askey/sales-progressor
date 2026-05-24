// Director-facing billing page.
//
// Shows the current month's running total — live, computed at page-load
// from PropertyTransaction rows directly, NOT from InvoiceLine rows. So
// "watch it build" feels instant regardless of cron cadence.
//
// The accrual cron writes durable InvoiceLine rows for billing history
// and Stripe issuance (PR 7); this page never depends on it having run.
//
// Negotiators get notFound() — same pattern as /agent/settings/automation.

import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { getCurrentMonthRunningTotal } from "@/lib/billing/running-total";

function formatPence(p: number): string {
  const negative = p < 0;
  const abs = Math.abs(p);
  const formatted = `£${(abs / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return negative ? `−${formatted}` : formatted;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatMonth(d: Date): string {
  // d is the UTC instant for "midnight on the 1st in London", which may be
  // 23:00 on the prior day in UTC during BST. Show the month using the
  // London zone for consistency with how the boundary is computed.
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    month: "long",
    year: "numeric",
  }).format(d);
}

export default async function BillingPage() {
  const session = await requireSession();
  if (session.user.role !== "director") notFound();
  const agencyId = session.user.agencyId;
  if (!agencyId) notFound();

  const total = await getCurrentMonthRunningTotal(agencyId);

  return (
    <>
      <PageHeader
        title="Billing"
        subtitle={`${formatMonth(total.monthStart)} — running total, updates live as files exchange`}
      />

      <div style={{ display: "grid", gap: 16, maxWidth: 880 }}>
        {/* Headline */}
        <div
          style={{
            background: "var(--agent-card-bg, white)",
            border: "1px solid var(--agent-border, #e5e7eb)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary, #6b7280)", marginBottom: 4 }}>
            This month
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {formatPence(total.totalPence)}
          </div>
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary, #6b7280)", marginTop: 8 }}>
            {total.inHouseCount} in-house · {total.outsourcedCount} outsourced
          </div>
        </div>

        {/* Lines */}
        <div
          style={{
            background: "var(--agent-card-bg, white)",
            border: "1px solid var(--agent-border, #e5e7eb)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {total.lines.length === 0 ? (
            <div style={{ padding: 24, color: "var(--agent-text-secondary, #6b7280)", fontSize: 14 }}>
              No exchanges this month yet. Files appear here the moment they exchange.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "var(--agent-table-head-bg, #f9fafb)", textAlign: "left" }}>
                  <th style={{ padding: "10px 16px", fontWeight: 500, fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
                    Exchanged
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 500, fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
                    File
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 500, fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
                    Service
                  </th>
                  <th style={{ padding: "10px 16px", fontWeight: 500, fontSize: 12, color: "var(--agent-text-secondary, #6b7280)", textAlign: "right" }}>
                    Fee
                  </th>
                </tr>
              </thead>
              <tbody>
                {total.lines.map((line) => (
                  <tr key={line.transactionId} style={{ borderTop: "1px solid var(--agent-border, #e5e7eb)" }}>
                    <td style={{ padding: "12px 16px", color: "var(--agent-text-secondary, #6b7280)" }}>
                      {formatDate(line.exchangedAt)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{line.propertyAddress}</td>
                    <td style={{ padding: "12px 16px", color: "var(--agent-text-secondary, #6b7280)" }}>
                      {line.bandLabel}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatPence(line.amountPence)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
          Billed monthly on exchange. Live total — updates the moment a file's exchange milestone is confirmed.
        </p>
      </div>
    </>
  );
}
