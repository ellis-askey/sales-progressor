import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/security/access-scope";
import { scopeTransactionWhere, scopeOwnershipWhere } from "@/lib/security/access-scope";

// Exchange-push: once a sale is ready on both sides but sits in a chain, the job
// is to chase every OTHER sale until all are ready, then exchange. Readiness is
// one value per chain link, computed one way and surfaced in two homes (the file
// Overview panel + the chains "Push to exchange" tab), so a tick in one shows in
// the other. Critique 2026-10-02.

export type ExchangeReadySource = "exchanged" | "confirmed" | "their_file" | "not_yet";

export type ExchangePushRow = {
  linkId: string;
  isUs: boolean;
  address: string;
  agentName: string | null;
  firmName: string | null;
  kind: "us" | "claimed" | "stub";
  ready: boolean;
  source: ExchangeReadySource;
  lastChasedAt: string | null; // ISO
  chaseable: boolean;
};

export type ExchangePush = {
  transactionId: string;
  address: string;
  rows: ExchangePushRow[];
  readyCount: number;
  total: number;
  allReady: boolean;
};

// The two gates the app already uses for "both sides ready to exchange".
const READY_CODES = ["VM18", "PM25"];
const EXCHANGED_CODES = ["VM19", "PM26"];

type LinkForPush = {
  id: string;
  position: number;
  transactionId: string | null;
  exchangeReadyConfirmedAt: Date | null;
  lastAgentChasedAt: Date | null;
  inviteStatus: string;
  stubPropertyAddress: string | null;
  stubAgencyName: string | null;
  stubAgentEmail: string | null;
  claimedBy: { name: string | null; firmName: string | null } | null;
  transaction: {
    id: string;
    propertyAddress: string;
    agencyId: string | null;
    exchangedAt: Date | null;
    milestoneCompletions: { state: string; milestoneDefinition: { code: string } }[];
  } | null;
};

const LINK_SELECT = {
  id: true,
  position: true,
  transactionId: true,
  exchangeReadyConfirmedAt: true,
  lastAgentChasedAt: true,
  inviteStatus: true,
  stubPropertyAddress: true,
  stubAgencyName: true,
  stubAgentEmail: true,
  claimedBy: { select: { name: true, firmName: true } },
  transaction: {
    select: {
      id: true,
      propertyAddress: true,
      agencyId: true,
      exchangedAt: true,
      milestoneCompletions: {
        where: { milestoneDefinition: { code: { in: [...READY_CODES, ...EXCHANGED_CODES] } } },
        select: { state: true, milestoneDefinition: { select: { code: true } } },
      },
    },
  },
};

type CompletionsHaver = { milestoneCompletions?: { state: string; milestoneDefinition: { code: string } }[] } | null | undefined;

function completedCodes(tx: CompletionsHaver): Set<string> {
  return new Set(
    (tx?.milestoneCompletions ?? [])
      .filter((c) => c.state === "complete")
      .map((c) => c.milestoneDefinition.code),
  );
}

// Is THIS file ready to exchange on both of its own sides? (VM18 + PM25 complete.)
function bothSidesReady(tx: CompletionsHaver): boolean {
  const codes = completedCodes(tx);
  return READY_CODES.every((c) => codes.has(c));
}

// One link's readiness, with how we know it. Auto-reading another file's state is
// only allowed where we can already see that file (internal staff, or our own
// agency's sale) — the same privacy wall Check-ins uses; otherwise it's our
// manual confirm (or it's exchanged).
function linkReady(
  link: LinkForPush,
  seeAll: boolean,
  ourAgencyId: string | null,
): { ready: boolean; source: ExchangeReadySource } {
  if (link.transaction?.exchangedAt) return { ready: true, source: "exchanged" };
  const exchangedCodes = completedCodes(link.transaction);
  if (EXCHANGED_CODES.some((c) => exchangedCodes.has(c))) return { ready: true, source: "exchanged" };
  if (link.exchangeReadyConfirmedAt) return { ready: true, source: "confirmed" };
  const canSee = seeAll || (link.transaction?.agencyId != null && link.transaction.agencyId === ourAgencyId);
  if (canSee && link.transaction && bothSidesReady(link.transaction)) {
    return { ready: true, source: "their_file" };
  }
  return { ready: false, source: "not_yet" };
}

function buildRows(fileTxId: string, links: LinkForPush[], seeAll: boolean, ourAgencyId: string | null): ExchangePushRow[] {
  return [...links]
    .sort((a, b) => a.position - b.position)
    .map((l) => {
      const isUs = l.transactionId === fileTxId;
      const claimed = l.transactionId != null;
      const kind: ExchangePushRow["kind"] = isUs ? "us" : claimed ? "claimed" : "stub";
      const r = isUs ? { ready: true, source: "confirmed" as const } : linkReady(l, seeAll, ourAgencyId);
      return {
        linkId: l.id,
        isUs,
        address: l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "Address not shared",
        agentName: isUs ? null : (claimed ? (l.claimedBy?.name ?? null) : null),
        firmName: isUs ? null : (claimed ? (l.claimedBy?.firmName ?? null) : (l.stubAgencyName ?? null)),
        kind,
        ready: r.ready,
        source: r.source,
        lastChasedAt: l.lastAgentChasedAt?.toISOString() ?? null,
        chaseable: !isUs && (claimed || !!l.stubAgentEmail),
      };
    });
}

function assemble(fileTxId: string, address: string, links: LinkForPush[], seeAll: boolean, ourAgencyId: string | null): ExchangePush {
  const rows = buildRows(fileTxId, links, seeAll, ourAgencyId);
  const readyCount = rows.filter((r) => r.ready).length;
  return { transactionId: fileTxId, address, rows, readyCount, total: rows.length, allReady: readyCount === rows.length };
}

const seesAll = (scope: AccessScope) => scope.kind === "all" || scope.kind === "assigned";

// One file's exchange-push checklist. Returns null when the file isn't in push
// mode (not in a chain, not ready on both sides, or already exchanged) — the
// Overview panel renders only when this is non-null. Scope-guarded.
export async function getExchangePushForTransaction(
  transactionId: string,
  scope: AccessScope,
): Promise<ExchangePush | null> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      agencyId: true,
      exchangedAt: true,
      chainLink: { select: { chainId: true } },
      milestoneCompletions: {
        where: { milestoneDefinition: { code: { in: READY_CODES } } },
        select: { state: true, milestoneDefinition: { select: { code: true } } },
      },
    },
  });
  if (!tx || tx.exchangedAt || !tx.chainLink?.chainId) return null;
  if (!bothSidesReady(tx)) return null;

  const links = await prisma.chainLink.findMany({
    where: { chainId: tx.chainLink.chainId },
    select: LINK_SELECT,
  });
  return assemble(tx.id, tx.propertyAddress, links as unknown as LinkForPush[], seesAll(scope), tx.agencyId);
}

export type ExchangePushSummary = {
  transactionId: string;
  address: string;
  readyCount: number;
  total: number;
  allReady: boolean;
  push: ExchangePush;
};

// Every sale in the viewer's scope that's in push mode (ready on both sides, in a
// chain, not exchanged), each with its full checklist. Powers the chains "Push to
// exchange" tab. Sorted most-progressed-first (closest to exchange).
export async function listExchangePushForScope(scope: AccessScope): Promise<ExchangePushSummary[]> {
  const ourTxns = await prisma.propertyTransaction.findMany({
    where: { AND: [scopeTransactionWhere(scope), { status: "active", exchangedAt: null, chainLinkId: { not: null } }] },
    select: {
      id: true,
      propertyAddress: true,
      agencyId: true,
      chainLink: { select: { chainId: true } },
      milestoneCompletions: {
        where: { milestoneDefinition: { code: { in: READY_CODES } } },
        select: { state: true, milestoneDefinition: { select: { code: true } } },
      },
    },
  });
  const ready = ourTxns.filter((t) => bothSidesReady(t));
  if (ready.length === 0) return [];

  const chainIds = [...new Set(ready.map((t) => t.chainLink?.chainId).filter((x): x is string => !!x))];
  const links = await prisma.chainLink.findMany({ where: { chainId: { in: chainIds } }, select: { ...LINK_SELECT, chainId: true } });
  const byChain = new Map<string, LinkForPush[]>();
  for (const l of links as unknown as (LinkForPush & { chainId: string })[]) {
    const arr = byChain.get(l.chainId) ?? [];
    arr.push(l);
    byChain.set(l.chainId, arr);
  }

  const seeAll = seesAll(scope);
  const out: ExchangePushSummary[] = [];
  for (const t of ready) {
    const chainLinks = byChain.get(t.chainLink!.chainId) ?? [];
    const push = assemble(t.id, t.propertyAddress, chainLinks, seeAll, t.agencyId);
    out.push({ transactionId: t.id, address: t.propertyAddress, readyCount: push.readyCount, total: push.total, allReady: push.allReady, push });
  }
  // Closest to done first (highest ready share), all-ready at the very top.
  out.sort((a, b) => (b.readyCount / b.total) - (a.readyCount / a.total));
  return out;
}
