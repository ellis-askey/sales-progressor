// app/api/cron/medians-ready-check/route.ts
//
// Daily cron — checks whether enough non-reconciled completion data has
// accumulated to consider swapping the hardcoded MILESTONE_DURATION_MEDIANS
// in lib/services/fees.ts for learned values. When the broad readiness
// threshold (≥50 distinct transactions with ≥1 completed milestone) is
// crossed, computes per-milestone medians + sample sizes from the actual
// data and sends Ellis (every superadmin) a comparison email via the
// existing OutboundEmailQueue.
//
// One-shot: a SystemNotification row keyed "medians_ready" is written
// after enqueueing. Subsequent cron runs short-circuit on row presence.
// To re-test on staging: DELETE that row, the next run will re-fire.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/lib/email/outboundQueue";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { MILESTONE_DURATION_MEDIANS } from "@/lib/services/fees";
import {
  renderMediansReadySubject,
  renderMediansReadyText,
  renderMediansReadyHtml,
  type PerMilestoneRow,
} from "@/lib/email/medians-ready";

const SYSTEM_NOTIFICATION_KEY = "medians_ready";
const TRANSACTION_THRESHOLD = 50;
const DAY_MS = 86_400_000;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. One-shot gate — exit immediately if already fired.
  const existing = await prisma.systemNotification.findUnique({
    where: { key: SYSTEM_NOTIFICATION_KEY },
  });
  if (existing) {
    return NextResponse.json({ status: "already_fired", firedAt: existing.firedAt });
  }

  // 2. Broad readiness check — count distinct transactions with ≥1
  //    non-reconciled completion. Cheap aggregate query.
  //    Migrated files excluded: their user-supplied historical timestamps
  //    would prematurely trip the 50-tx threshold without giving real
  //    samples, and would skew the median when finally computed.
  const txnsWithActivity = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      reconciledAtClaim: false,
      transaction: { isMigrated: false },
    },
    select: { transactionId: true },
    distinct: ["transactionId"],
  });
  const transactionCount = txnsWithActivity.length;
  if (transactionCount < TRANSACTION_THRESHOLD) {
    return NextResponse.json({ status: "below_threshold", transactionCount, threshold: TRANSACTION_THRESHOLD });
  }

  // 3. Threshold crossed — compute per-milestone median + sample size.
  //    Load all non-reconciled "complete" rows grouped by transaction so we
  //    can compute each milestone's becameAvailableAt proxy locally.
  //    Migrated transactions excluded (matches the readiness check above).
  const allCompletions = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      reconciledAtClaim: false,
      transaction: { isMigrated: false },
    },
    select: {
      transactionId: true,
      completedAt: true,
      milestoneDefinition: { select: { code: true, name: true } },
    },
  });

  // Per-transaction map of code → completedAt (for prereq lookup).
  const completionsByTxn = new Map<string, Map<string, Date>>();
  for (const c of allCompletions) {
    if (!c.completedAt || !c.milestoneDefinition) continue;
    let m = completionsByTxn.get(c.transactionId);
    if (!m) {
      m = new Map();
      completionsByTxn.set(c.transactionId, m);
    }
    m.set(c.milestoneDefinition.code, c.completedAt);
  }

  // Collect durations per milestone code. Duration = completedAt − latest
  // direct-prereq completedAt. Skip rows where the proxy is uncomputable
  // (top-of-tree milestones, or any prereq not in the transaction's set).
  const durationsByCode = new Map<string, number[]>();
  const nameByCode = new Map<string, string>();
  for (const c of allCompletions) {
    if (!c.completedAt || !c.milestoneDefinition) continue;
    const code = c.milestoneDefinition.code;
    if (!nameByCode.has(code)) nameByCode.set(code, c.milestoneDefinition.name);

    const prereqs = DIRECT_PREREQUISITES[code];
    if (!prereqs || prereqs.length === 0) continue;
    const txnMap = completionsByTxn.get(c.transactionId);
    if (!txnMap) continue;

    let latestPrereq: number | null = null;
    let allKnown = true;
    for (const p of prereqs) {
      const pAt = txnMap.get(p);
      if (!pAt) { allKnown = false; break; }
      const t = pAt.getTime();
      if (latestPrereq === null || t > latestPrereq) latestPrereq = t;
    }
    if (!allKnown || latestPrereq === null) continue;

    const days = Math.floor((c.completedAt.getTime() - latestPrereq) / DAY_MS);
    if (days < 0) continue; // out-of-order completion, skip
    const arr = durationsByCode.get(code) ?? [];
    arr.push(days);
    durationsByCode.set(code, arr);
  }

  function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  }

  // Assemble rows for every code that EITHER has a hardcoded value OR has
  // accumulated samples — we want the full picture, even on rows where the
  // computed value is null. Order: VM1..VM20 then PM1..PM27.
  const allCodes = new Set<string>([
    ...Object.keys(MILESTONE_DURATION_MEDIANS),
    ...nameByCode.keys(),
  ]);
  const codeSortKey = (code: string): number => {
    const sidePrefix = code.startsWith("VM") ? 0 : 1;
    const num = parseInt(code.replace(/^(VM|PM)/, ""), 10);
    return sidePrefix * 1000 + (isNaN(num) ? 0 : num);
  };
  const rows: PerMilestoneRow[] = [...allCodes]
    .sort((a, b) => codeSortKey(a) - codeSortKey(b))
    .map((code) => ({
      code,
      name: nameByCode.get(code) ?? code,
      currentHardcoded: MILESTONE_DURATION_MEDIANS[code] ?? 0,
      computedMedian: median(durationsByCode.get(code) ?? []),
      sampleSize: (durationsByCode.get(code) ?? []).length,
    }));

  // 4. Recipients — every superadmin User.
  const superadmins = await prisma.user.findMany({
    where: { role: "superadmin" },
    select: { id: true, email: true, name: true },
  });
  if (superadmins.length === 0) {
    console.warn("[medians-ready-check] threshold crossed but no superadmin users found — cannot deliver email");
    // Do NOT write SystemNotification — without a recipient we never delivered,
    // so the next cron run should retry once superadmins exist.
    return NextResponse.json({
      status: "no_recipient",
      transactionCount,
      rowCount: rows.length,
    });
  }

  // 5. Enqueue email per recipient via the existing OutboundEmailQueue.
  //    drainOutboundQueue (the daily 09:00 cron) ships it during business hours.
  const subject = renderMediansReadySubject();
  const text = renderMediansReadyText({ triggerTransactionCount: transactionCount, rows });
  const html = renderMediansReadyHtml({ triggerTransactionCount: transactionCount, rows });
  let enqueued = 0;
  for (const sa of superadmins) {
    if (!sa.email) continue;
    try {
      await enqueueEmail({
        emailType: "MEDIANS_READY",
        sourceId: SYSTEM_NOTIFICATION_KEY, // dedup'd against (emailType, sourceId, recipientUserId)
        recipientEmail: sa.email,
        recipientUserId: sa.id,
        payload: { subject, text, html },
      });
      enqueued++;
    } catch (err) {
      console.error(`[medians-ready-check] enqueue failed for superadmin ${sa.id}:`, err);
    }
  }

  // 6. Write the one-shot flag. Even if some enqueues failed individually,
  //    we don't want to re-fire on the next run — the OutboundEmailQueue's
  //    unique constraint will dedup any retries during the same window
  //    anyway. The flag's job is to stop re-COUNTING + re-enqueueing.
  await prisma.systemNotification.create({
    data: { key: SYSTEM_NOTIFICATION_KEY, firedAt: new Date() },
  });

  return NextResponse.json({
    status: "fired",
    transactionCount,
    rowCount: rows.length,
    enqueued,
    recipients: superadmins.length,
  });
}
