// lib/services/focus.ts
//
// Data for the founder-only Focus page. Two feeds:
//   - getFocusLeft(vis)  — the merged "client communications" cockpit: the weekly
//     "touch every side" quota (reused wholesale from getWeeklyTouch) enriched,
//     per side, with the LAST AUTOMATED client email (so you can see what actually
//     landed in their inbox + its delivery/open status) and a bounce flag (that
//     client is unreachable). Human-touch recency still drives the quiet/quota.
//   - getFocusRight(scope, vis) — the right rail: the three most urgent open
//     enquiries, and the files whose searches were ordered longest ago but whose
//     results aren't back yet.
//
// Everything is scoped to TSP's own outsourced book (via the vis / scope the
// page passes), matching every other internal surface.

import { prisma } from "@/lib/prisma";
import { getWeeklyTouch, type WeeklyTouchSide, type WeeklyTouchFile } from "@/lib/services/hub";
import { getOpenEnquiries, type OpenEnquiryRow } from "@/lib/services/enquiries";
import { txWhereWorkQueue } from "@/lib/services/work-queue";
import { loadActiveRoundIds, roundScopedOR } from "@/lib/services/round-scope";
import type { AgentVisibility } from "@/lib/services/agent";
import type { AccessScope } from "@/lib/security/access-scope";

// ─── Left: client communications ──────────────────────────────────────────────

export type FocusEmailState = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "failed";

export type FocusAutoEmail = {
  id: string;             // OutboundMessage id — opens the exact email we sent
  subject: string | null;
  kind: string;           // friendly label ("Chase", "Update", …)
  sentAt: Date;
  state: FocusEmailState;
};

export type FocusSide = WeeklyTouchSide & {
  // The most recent AUTOMATED email that reached this side's client(s), with its
  // real delivery status. Shown as a quiet secondary line; does NOT count as a
  // human touch, so it never resets the quiet clock.
  lastAutoEmail: FocusAutoEmail | null;
  // This side's client email has bounced — they're unreachable, nothing is landing.
  bounced: boolean;
};

export type FocusLeftFile = Omit<WeeklyTouchFile, "sides"> & { sides: FocusSide[] };
export type FocusLeft = { files: FocusLeftFile[]; totalSides: number; doneSides: number };

const PURPOSE_LABEL: Record<string, string> = {
  chase: "Chase",
  notification: "Update",
  digest: "Weekly update",
  other: "Email",
};

function emailState(m: {
  status: string; deliveredAt: Date | null; openedAt: Date | null; clickedAt: Date | null; failedAt: Date | null;
}): FocusEmailState {
  if (m.status === "bounced") return "bounced";
  if (m.failedAt || m.status === "failed") return "failed";
  if (m.clickedAt) return "clicked";
  if (m.openedAt) return "opened";
  if (m.deliveredAt) return "delivered";
  return "sent";
}

export async function getFocusLeft(vis: AgentVisibility): Promise<FocusLeft> {
  const weekly = await getWeeklyTouch(vis);
  const fileIds = weekly.files.map((f) => f.transactionId);
  const contactIds = [...new Set(weekly.files.flatMap((f) => f.sides.flatMap((s) => s.contactIds)))];

  if (contactIds.length === 0) {
    return {
      files: weekly.files.map((f) => ({ ...f, sides: f.sides.map((s) => ({ ...s, lastAutoEmail: null, bounced: false })) })),
      totalSides: weekly.totalSides,
      doneSides: weekly.doneSides,
    };
  }

  const [autoRows, bouncedContacts] = await Promise.all([
    prisma.outboundMessage.findMany({
      where: {
        transactionId: { in: fileIds },
        contactIds: { hasSome: contactIds },
        type: "outbound",
        isAutomated: true,
        channel: "email",
        sentAt: { not: null },
      },
      orderBy: { sentAt: "desc" },
      take: 600,
      select: {
        id: true, subject: true, purpose: true, sentAt: true, status: true,
        deliveredAt: true, openedAt: true, clickedAt: true, failedAt: true, contactIds: true,
      },
    }),
    prisma.contact.findMany({
      where: { id: { in: contactIds }, emailBouncedAt: { not: null } },
      select: { id: true },
    }),
  ]);
  const bouncedSet = new Set(bouncedContacts.map((c) => c.id));

  const files: FocusLeftFile[] = weekly.files.map((f) => ({
    ...f,
    sides: f.sides.map((s) => {
      const sideSet = new Set(s.contactIds);
      // autoRows are newest-first → the first overlap is the latest auto email.
      const hit = autoRows.find((m) => m.contactIds.some((id) => sideSet.has(id)));
      const lastAutoEmail: FocusAutoEmail | null = hit?.sentAt
        ? { id: hit.id, subject: hit.subject, kind: PURPOSE_LABEL[hit.purpose] ?? "Email", sentAt: hit.sentAt, state: emailState(hit) }
        : null;
      return { ...s, lastAutoEmail, bounced: s.contactIds.some((id) => bouncedSet.has(id)) };
    }),
  }));

  return { files, totalSides: weekly.totalSides, doneSides: weekly.doneSides };
}

// ─── Right: enquiries + searches ──────────────────────────────────────────────

export type FocusEnquiry = {
  transactionId: string;
  address: string;
  clientNames: string;
  withLabel: string;           // who holds it: "Seller's solicitor" / "Buyer's solicitor"
  solicitorName: string | null;
  quietDays: number;
  stage: "chase" | "escalate" | "escalated" | "hold";
  stalled: boolean;
  needsAttention: boolean;
};

export type FocusSearch = {
  transactionId: string;
  address: string;
  orderedAt: Date;
  daysAgo: number;
};

export type FocusRight = {
  enquiries: FocusEnquiry[];
  openEnquiryCount: number;
  searches: FocusSearch[];
  searchCount: number;
};

// Worst-first ranking for the top-3: gone-dark (stalled) → needs-you → the rest →
// snoozed, then longest-quiet within each band.
function enquiryRank(e: OpenEnquiryRow): number {
  if (e.stalled) return 0;
  if (e.needsAttention) return 1;
  if (e.status === "snoozed") return 3;
  return 2;
}

export async function getFocusRight(scope: AccessScope, vis: AgentVisibility): Promise<FocusRight> {
  const [openEnquiries, searches] = await Promise.all([
    getOpenEnquiries(scope),
    getSearchesOutstanding(vis),
  ]);

  const ranked = [...openEnquiries].sort((a, b) => enquiryRank(a) - enquiryRank(b) || b.quietDays - a.quietDays);
  const enquiries: FocusEnquiry[] = ranked.slice(0, 3).map((e) => ({
    transactionId: e.transactionId,
    address: e.address,
    clientNames: e.clientNames,
    withLabel: e.currentlyWith === "seller_solicitor" ? "Seller's solicitor" : "Buyer's solicitor",
    solicitorName: e.currentlyWith === "seller_solicitor" ? e.vendorSolicitor : e.purchaserSolicitor,
    quietDays: e.quietDays,
    stage: e.chaseBar.stage,
    stalled: e.stalled,
    needsAttention: e.needsAttention,
  }));

  return { enquiries, openEnquiryCount: openEnquiries.length, searches: searches.slice(0, 5), searchCount: searches.length };
}

// Files where searches were ordered (PM8 complete) but results aren't back
// (PM13 not complete), oldest-ordered first. Age uses the real eventDate when
// set, else the system completedAt. Round-scoped so a relisted file's previous
// buyer's PM8 can't match. TSP's own outsourced book only.
async function getSearchesOutstanding(vis: AgentVisibility): Promise<FocusSearch[]> {
  const txWhere = txWhereWorkQueue(vis); // admin_all → { serviceType: "outsourced", ...TSP_ONLY }
  const activeRoundIds = await loadActiveRoundIds(txWhere);

  const rows = await prisma.milestoneCompletion.findMany({
    where: {
      state: "complete",
      milestoneDefinition: { code: "PM8" },
      OR: roundScopedOR(activeRoundIds),
      transaction: {
        ...txWhere,
        status: "active",
        isDemo: false,
        milestoneCompletions: { none: { state: "complete", milestoneDefinition: { code: "PM13" } } },
      },
    },
    orderBy: [{ eventDate: "asc" }, { completedAt: "asc" }],
    distinct: ["transactionId"],
    take: 30,
    select: { eventDate: true, completedAt: true, transaction: { select: { id: true, propertyAddress: true } } },
  });

  const now = Date.now();
  return rows
    .map((r): FocusSearch | null => {
      const ordered = r.eventDate ?? r.completedAt;
      if (!ordered || !r.transaction) return null;
      return {
        transactionId: r.transaction.id,
        address: r.transaction.propertyAddress,
        orderedAt: ordered,
        daysAgo: Math.floor((now - ordered.getTime()) / 86_400_000),
      };
    })
    .filter((x): x is FocusSearch => x !== null)
    .sort((a, b) => b.daysAgo - a.daysAgo); // oldest ordered first
}
