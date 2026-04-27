import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getAgentTransactions } from "@/lib/services/agent";

type AgentTx = Awaited<ReturnType<typeof getAgentTransactions>>[number];

const ROLE_LABEL: Record<string, string> = {
  director:         "Director",
  negotiator:       "Negotiator",
  sales_progressor: "Progressor",
};

const PERIOD_LABELS: Record<string, string> = {
  week:  "This week",
  month: "This month",
  year:  "This year",
  all:   "All time",
};

function calcFeeIncVat(t: AgentTx): number | null {
  let feeEx: number | null = null;
  if (t.agentFeeAmount != null) feeEx = t.agentFeeAmount;
  else if (t.agentFeePercent != null && t.purchasePrice != null)
    feeEx = Math.round(t.purchasePrice * Number(t.agentFeePercent) / 100);
  if (feeEx == null) return null;
  return t.agentFeeIsVatInclusive ? feeEx : Math.round(feeEx * 1.2);
}

function fmtGBP(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

function csvCell(val: string | number): string {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function row(...cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getPeriodStart(p: string): Date | null {
  const now = new Date();
  if (p === "week")  { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "year")  return new Date(now.getFullYear(), 0, 1);
  return null;
}

function fmtNameShort(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (session.user.role !== "director") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawPeriod    = searchParams.get("period") ?? "month";
  const filterUserId = searchParams.get("user") ?? undefined;
  const period       = (["week", "month", "year", "all"] as string[]).includes(rawPeriod) ? rawPeriod : "month";

  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const effectiveVis = filterUserId
    ? { userId: filterUserId, agencyId: session.user.agencyId, seeAll: false, firmName: null }
    : vis;

  const transactions = await getAgentTransactions(effectiveVis);
  const since        = getPeriodStart(period);
  const periodTx     = since ? transactions.filter(t => new Date(t.createdAt) >= since) : transactions;
  const exchanged    = periodTx.filter(t => t.hasExchanged);
  const completed    = periodTx.filter(t => t.hasCompleted);

  const pipelineValuePence  = periodTx.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);
  const exchangedValuePence = exchanged.reduce((s, t) => s + (t.purchasePrice ?? 0), 0);

  const feesAll        = periodTx.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const feeExchanged   = exchanged.map(calcFeeIncVat).filter((f): f is number => f !== null);
  const totalFeePence  = feesAll.reduce((a, b) => a + b, 0);
  const lockedFeePence = feeExchanged.reduce((a, b) => a + b, 0);
  const avgFeePence    = feesAll.length > 0 ? Math.round(totalFeePence / feesAll.length) : 0;
  const noFeeCount     = periodTx.filter(t => calcFeeIncVat(t) === null).length;

  const noFeeTransactions = transactions.filter(t => calcFeeIncVat(t) === null && t.status === "active");

  const referredTxs     = periodTx.filter(t => t.referredFirmId);
  const inPipelineTxs   = referredTxs.filter(t => !t.hasExchanged && !t.hasCompleted);
  const dueTxs          = referredTxs.filter(t => t.hasExchanged || t.hasCompleted);
  const inPipelinePence = inPipelineTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);
  const duePence        = dueTxs.reduce((s, t) => s + (t.referralFee ?? 0), 0);

  // ── Build CSV ──────────────────────────────────────────────────────────────
  const now         = new Date();
  const dateStr     = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timeStr     = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const agencyName  = vis.firmName ?? "Your agency";
  const periodLabel = PERIOD_LABELS[period] ?? "This month";

  const lines: string[] = [
    "Sales Progressor — Analytics Export",
    row("Agency:",    agencyName),
    row("Period:",    periodLabel),
    row("Generated:", `${dateStr} ${timeStr}`),
    "",
    "OVERVIEW",
    row("Files submitted", periodTx.length),
    row("Exchanged",       exchanged.length),
    row("Completed",       completed.length),
    row("Pipeline value",  pipelineValuePence  > 0 ? fmtGBP(pipelineValuePence)  : "—"),
    row("Value exchanged", exchangedValuePence > 0 ? fmtGBP(exchangedValuePence) : "—"),
    "",
    "FEES",
    row("Total fee pipeline",  feesAll.length      > 0 ? fmtGBP(totalFeePence)  : "—"),
    row("Fees locked in",      feeExchanged.length > 0 ? fmtGBP(lockedFeePence) : "—"),
    row("Average fee",         feesAll.length      > 0 ? fmtGBP(avgFeePence)    : "—"),
    row("Files missing a fee", noFeeCount),
  ];

  if (noFeeTransactions.length > 0) {
    lines.push("", "FILES MISSING A FEE", row("Address", "Owner", "Role"));
    for (const t of noFeeTransactions) {
      let ownerName = "";
      let role      = "";
      if (t.serviceType === "self_managed" || t.serviceType === null) {
        ownerName = t.agentUser ? fmtNameShort(t.agentUser.name) : "";
        role      = t.agentUser ? (ROLE_LABEL[t.agentUser.role] ?? t.agentUser.role) : "";
      } else if (t.assignedUser) {
        ownerName = fmtNameShort(t.assignedUser.name);
        role      = ROLE_LABEL[t.assignedUser.role] ?? t.assignedUser.role;
      } else {
        ownerName = "Awaiting assignment";
      }
      lines.push(row(t.propertyAddress, ownerName, role));
    }
  }

  if (referredTxs.length > 0) {
    lines.push(
      "",
      "REFERRAL INCOME",
      row("In pipeline",          inPipelinePence > 0 ? fmtGBP(inPipelinePence) : "—"),
      row("Exchanged — due", duePence        > 0 ? fmtGBP(duePence)        : "—"),
    );
  }

  const csv        = lines.join("\r\n");
  const slugPeriod = slugify(periodLabel);
  const slugAgency = slugify(agencyName);
  const dateSlug   = now.toISOString().slice(0, 10).replace(/-/g, "");
  const filename   = `analytics-${slugAgency}-${slugPeriod}-${dateSlug}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
