// Automation coverage rollup for /agent/automated-emails.
//
// One row per ACTIVE file in the caller's scope, bucketed into how well
// automation can actually run on it. Answers "for every file we're watching,
// is automation set up and running?" — the health question the KPIs and the
// per-email feed can't, because they only see emails that already exist.
//
//   covered   — automation on, every client contact has an address. Healthy.
//   needInfo  — automation on, but a client contact has no email, so the chase
//               engine can't reach them (it requires an address). A setup gap.
//   paused    — automation is off for this file: the global gate, the agency
//               toggle, or the per-file pause. Nothing sends until resumed.
//
// Scoped through resolveEmailScope like every other module on this surface, so
// the rollup can never count a file the viewer may not see. The needInfo bucket
// is the file-level companion to the "missing email" cards in Needs attention.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveEmailScope, type EmailScopeInput } from "@/lib/services/automated-emails-scope";

// The chase cron's global gate (mirrors automated-emails-preview.ts). Anything
// other than the literal "true" leaves every file's chases dormant.
function chaseGloballyPaused(): boolean {
  return process.env.CLIENT_CHASE_ENABLED !== "true";
}

export type AutomationCoverage = {
  total: number;    // active files in scope
  covered: number;
  needInfo: number;
  paused: number;
};

export async function getAutomationCoverage(input: EmailScopeInput): Promise<AutomationCoverage> {
  const { txIds } = await resolveEmailScope(input);
  if (txIds.length === 0) return { total: 0, covered: 0, needInfo: 0, paused: 0 };

  const globalOff = chaseGloballyPaused();
  const txs = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds }, status: "active" },
    select: {
      id: true,
      clientEmailsPaused: true,
      agency: { select: { chaseEmailsEnabled: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { email: true },
      },
    },
  });

  let covered = 0;
  let needInfo = 0;
  let paused = 0;
  for (const t of txs) {
    // Most-global pause wins, matching the preview service's pause precedence.
    if (globalOff || t.agency?.chaseEmailsEnabled === false || t.clientEmailsPaused) {
      paused++;
      continue;
    }
    const missingEmail = t.contacts.some((c) => !c.email || c.email.trim() === "");
    if (missingEmail) needInfo++;
    else covered++;
  }

  return { total: txs.length, covered, needInfo, paused };
}

// ── Per-file rollup (the Files tab) ──────────────────────────────────────────

export type FileCoverageStatus = "covered" | "needInfo" | "paused";

export type FileAutomationRow = {
  txId: string;
  address: string;
  status: FileCoverageStatus;
  pauseReason: "global" | "agency" | "file" | null;
  pendingCount: number;
  nextSendAt: Date | null;
  issuesCount: number;
};

// A genuine send failure — excludes the two non-failures that also stamp
// errorAt (dead-round skips + manual cancellations). Mirrors the feed's
// genuineFailurePred so "issues" means the same thing everywhere.
const genuineErrorPred: Prisma.OutboundEmailQueueWhereInput = {
  AND: [
    { errorAt: { not: null } },
    { NOT: { OR: [{ errorMessage: { in: ["recipient_round_archived"] } }, { errorMessage: { startsWith: "Cancelled" } }] } },
  ],
};

// One row per ACTIVE file in scope: its coverage status plus the live counts
// an agent scans for (what's queued, when the next send is, how many issues).
// Aggregated in memory — Prisma can't groupBy across the recipientContact
// relation, and pre-launch volumes are small. `search` narrows by address.
export async function getAutomationFiles(input: EmailScopeInput, search?: string): Promise<FileAutomationRow[]> {
  const { txIds, txAddressById, queueScope, solicitorScope } = await resolveEmailScope(input);
  if (txIds.length === 0) return [];
  const globalOff = chaseGloballyPaused();

  const [txs, pendingRows, queueIssues, solIssues] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { id: { in: txIds }, status: "active" },
      select: {
        id: true,
        clientEmailsPaused: true,
        agency: { select: { chaseEmailsEnabled: true } },
        contacts: { where: { roleType: { in: ["vendor", "purchaser"] } }, select: { email: true } },
      },
    }),
    prisma.outboundEmailQueue.findMany({
      where: { ...queueScope, sentAt: null, errorAt: null },
      select: { scheduledFor: true, recipientContact: { select: { propertyTransactionId: true } } },
      take: 20000,
    }),
    prisma.outboundEmailQueue.findMany({
      where: { ...queueScope, OR: [{ bouncedAt: { not: null } }, { blockedAt: { not: null } }, genuineErrorPred] },
      select: { recipientContact: { select: { propertyTransactionId: true } } },
      take: 20000,
    }),
    prisma.outboundMessage.findMany({
      where: { ...solicitorScope, OR: [{ status: { in: ["failed", "bounced"] } }, { failedAt: { not: null } }] },
      select: { transactionId: true },
      take: 20000,
    }),
  ]);

  const pendingByFile = new Map<string, { count: number; next: Date | null }>();
  for (const r of pendingRows) {
    const id = r.recipientContact?.propertyTransactionId;
    if (!id) continue;
    const cur = pendingByFile.get(id) ?? { count: 0, next: null };
    cur.count++;
    if (!cur.next || r.scheduledFor < cur.next) cur.next = r.scheduledFor;
    pendingByFile.set(id, cur);
  }

  const issuesByFile = new Map<string, number>();
  for (const r of queueIssues) {
    const id = r.recipientContact?.propertyTransactionId;
    if (id) issuesByFile.set(id, (issuesByFile.get(id) ?? 0) + 1);
  }
  for (const m of solIssues) {
    if (m.transactionId) issuesByFile.set(m.transactionId, (issuesByFile.get(m.transactionId) ?? 0) + 1);
  }

  const needle = search?.trim().toLowerCase();
  const rows: FileAutomationRow[] = [];
  for (const t of txs) {
    const address = txAddressById.get(t.id) ?? "(unknown file)";
    if (needle && !address.toLowerCase().includes(needle)) continue;

    let status: FileCoverageStatus;
    let pauseReason: FileAutomationRow["pauseReason"] = null;
    if (globalOff) { status = "paused"; pauseReason = "global"; }
    else if (t.agency?.chaseEmailsEnabled === false) { status = "paused"; pauseReason = "agency"; }
    else if (t.clientEmailsPaused) { status = "paused"; pauseReason = "file"; }
    else if (t.contacts.some((c) => !c.email || c.email.trim() === "")) { status = "needInfo"; }
    else { status = "covered"; }

    const pending = pendingByFile.get(t.id);
    rows.push({
      txId: t.id,
      address,
      status,
      pauseReason,
      pendingCount: pending?.count ?? 0,
      nextSendAt: pending?.next ?? null,
      issuesCount: issuesByFile.get(t.id) ?? 0,
    });
  }

  // Attention first: issues, then need-info, then paused, then covered; within
  // each, more issues / more pending first, then alphabetical for a stable feed.
  const rank = (r: FileAutomationRow): number =>
    r.issuesCount > 0 ? 0 : r.status === "needInfo" ? 1 : r.status === "paused" ? 2 : 3;
  rows.sort((a, b) =>
    rank(a) - rank(b) ||
    b.issuesCount - a.issuesCount ||
    b.pendingCount - a.pendingCount ||
    a.address.localeCompare(b.address),
  );
  return rows;
}
