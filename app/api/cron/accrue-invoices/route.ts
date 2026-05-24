// Daily accrual cron for the payments model.
//
// For each agency with billed exchanges in the current London billing month,
// ensures a single open Invoice row and reconciles its InvoiceLine rows
// against the source of truth (PropertyTransaction.billedAtExchange).
// Applies any unapplied CreditNote rows.
//
// Idempotent: re-runs add only new lines, remove orphans (from PR 4 branch
// (a) reversals that cleared billedAtExchange), and apply only credits that
// haven't been applied yet.
//
// The director-facing /agent/billing page reads from
// lib/billing/running-total.ts — which queries PropertyTransaction
// directly — so the live total never depends on this cron having run since
// the last exchange. This cron writes the DURABLE billing history for
// Stripe issuance (PR 7).
//
// Schedule: 03:00 UTC daily (matches existing housekeeping crons).

import { NextRequest, NextResponse } from "next/server";
import { accrueInvoicesForCurrentMonth } from "@/lib/billing/accrual";

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await accrueInvoicesForCurrentMonth();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[accrue-invoices] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
