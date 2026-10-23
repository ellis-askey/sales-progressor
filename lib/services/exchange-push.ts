import "server-only";
import { prisma } from "@/lib/prisma";
import type { AccessScope } from "@/lib/security/access-scope";
import { scopeTransactionWhere, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { isTerminalSale } from "@/lib/transactions/status";

// Exchange-push: once a sale is ready on both sides but sits in a chain, the job
// is to chase every OTHER sale until all are ready, then exchange. Readiness is
// one value per chain link, computed one way and surfaced in two homes (the file
// Overview panel + the chains "Push to exchange" tab), so a tick in one shows in
// the other. Critique 2026-10-02.

export type ExchangeReadySource = "exchanged" | "confirmed" | "their_file" | "not_yet";

export type ExchangePushRow = {
  linkId: string;
  isUs: boolean;
  // A sale the viewer genuinely runs (their agency's file, their business's book,
  // or a file assigned to them) — not merely one they can see. Reads "Your sale"
  // even when it isn't the open file; the open file is also `ours`. (critique #284)
  ours: boolean;
  address: string;
  agentName: string | null;
  firmName: string | null;
  kind: "us" | "claimed" | "stub";
  ready: boolean;
  source: ExchangeReadySource;
  lastChasedAt: string | null; // ISO
  chaseable: boolean;
  // Signed property photo (or null → the UI shows the house-glyph fallback).
  // Only resolved for files we can see / our own stubs — never another agency's.
  photoUrl: string | null;
  // Who confirmed this sale ready (when source === "confirmed"). For our own sale
  // it's the viewer; for a toggled chain link it's whoever flipped it.
  confirmedByName: string | null;
  confirmedByImage: string | null;
};

export type ExchangeViewer = { id: string; name: string | null };

// Resolved internally (avatar fetched from the User table) — the "Confirmed by"
// fallback for our own sale and for an optimistic toggle before the round-trip.
type ResolvedViewer = { name: string | null; image: string | null };

export type ExchangePush = {
  transactionId: string;
  address: string;
  rows: ExchangePushRow[];
  readyCount: number;
  total: number;
  allReady: boolean;
  // The current user — the fallback "Confirmed by" for our own sale and for an
  // optimistic toggle before the server round-trip fills in the real confirmer.
  viewerName: string | null;
  viewerImage: string | null;
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
  stubPhotoStoragePath: string | null;
  claimedBy: { name: string | null; firmName: string | null } | null;
  exchangeReadyConfirmedById: string | null;
  transaction: {
    id: string;
    propertyAddress: string;
    agencyId: string | null;
    assignedUserId: string | null;
    progressionBusinessId: string | null;
    photoStoragePath: string | null;
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
  stubPhotoStoragePath: true,
  claimedBy: { select: { name: true, firmName: true } },
  exchangeReadyConfirmedById: true,
  transaction: {
    select: {
      id: true,
      propertyAddress: true,
      agencyId: true,
      assignedUserId: true,
      progressionBusinessId: true,
      photoStoragePath: true,
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

// Which stored photo a row should show — our own file, a claimed file we can see,
// or a stub we created. Never another agency's file we can't already see.
function linkPhotoPath(l: LinkForPush, isUs: boolean, claimed: boolean, seeAll: boolean, ourAgencyId: string | null): string | null {
  if (!claimed) return l.stubPhotoStoragePath ?? null; // a stub we created
  const canSee = isUs || seeAll || (l.transaction?.agencyId != null && l.transaction.agencyId === ourAgencyId);
  return canSee ? (l.transaction?.photoStoragePath ?? null) : null;
}

type ConfirmerMap = Map<string, { name: string | null; image: string | null }>;

// Does the viewer genuinely RUN this claimed sale (not merely see it)? Mirrors
// the intent of #284: our agency's file, our business's book, or a file assigned
// to us. The all / platform scopes (TSP admin / founder) see the whole platform,
// so "can read" is far too broad for a "Your sale" label — for them a node is
// ours only when it's assigned to the viewer (the hybrid progressor case) or is
// the open file (handled separately). Unclaimed stubs are never "ours".
function linkIsOurs(scope: AccessScope, viewerId: string, l: LinkForPush): boolean {
  const tx = l.transaction;
  if (!tx) return false;
  switch (scope.kind) {
    case "agency":   return tx.agencyId != null && scope.agencyIds.includes(tx.agencyId);
    case "business": return tx.progressionBusinessId === scope.businessId;
    case "assigned": return tx.assignedUserId === scope.userId;
    case "all":
    case "platform": return tx.assignedUserId === viewerId;
  }
}

function buildRows(
  fileTxId: string,
  links: LinkForPush[],
  scope: AccessScope,
  viewerId: string,
  seeAll: boolean,
  ourAgencyId: string | null,
  viewer: ResolvedViewer,
  photoMap: Map<string, string>,
  confirmers: ConfirmerMap,
): ExchangePushRow[] {
  return [...links]
    .sort((a, b) => a.position - b.position)
    .map((l) => {
      const isUs = l.transactionId === fileTxId;
      const claimed = l.transactionId != null;
      // "ours" = a sale we run. The open file always counts; other claimed links
      // count when the viewer runs them. Drives the "Your sale" label and switches
      // the Chase button off (you don't chase your own sale). Readiness is NOT
      // forced for our OTHER sales — it comes from their own milestones (or a
      // manual confirm), only the open file is force-ready. (critique #284)
      const ours = isUs || (claimed && linkIsOurs(scope, viewerId, l));
      const kind: ExchangePushRow["kind"] = isUs ? "us" : claimed ? "claimed" : "stub";
      const r = isUs ? { ready: true, source: "confirmed" as const } : linkReady(l, seeAll, ourAgencyId);
      const photoPath = linkPhotoPath(l, isUs, claimed, seeAll, ourAgencyId);
      // Confirmer: our own sale → the viewer; a toggled link → whoever flipped it.
      const confirmer = isUs
        ? { name: viewer.name, image: viewer.image }
        : r.source === "confirmed" && l.exchangeReadyConfirmedById
          ? confirmers.get(l.exchangeReadyConfirmedById) ?? { name: null, image: null }
          : { name: null, image: null };
      return {
        linkId: l.id,
        isUs,
        ours,
        address: l.transaction?.propertyAddress ?? l.stubPropertyAddress ?? "Address not shared",
        // Keep the agent who added/claimed a link even when it's one of ours, so
        // the label can read "Your sale · added by {agent}". Only the open file
        // (isUs) drops it — it's the file you're literally on.
        agentName: isUs ? null : (claimed ? (l.claimedBy?.name ?? null) : null),
        firmName: isUs ? null : (claimed ? (l.claimedBy?.firmName ?? null) : (l.stubAgencyName ?? null)),
        kind,
        ready: r.ready,
        source: r.source,
        lastChasedAt: l.lastAgentChasedAt?.toISOString() ?? null,
        // Don't offer to chase a sale we run — only genuinely other sales.
        chaseable: !ours && (claimed || !!l.stubAgentEmail),
        photoUrl: photoPath ? (photoMap.get(photoPath) ?? null) : null,
        confirmedByName: confirmer.name,
        confirmedByImage: confirmer.image,
      };
    });
}

function assemble(
  fileTxId: string,
  address: string,
  links: LinkForPush[],
  scope: AccessScope,
  viewerId: string,
  seeAll: boolean,
  ourAgencyId: string | null,
  viewer: ResolvedViewer,
  photoMap: Map<string, string>,
  confirmers: ConfirmerMap,
): ExchangePush {
  const rows = buildRows(fileTxId, links, scope, viewerId, seeAll, ourAgencyId, viewer, photoMap, confirmers);
  const readyCount = rows.filter((r) => r.ready).length;
  return {
    transactionId: fileTxId, address, rows, readyCount, total: rows.length,
    allReady: readyCount === rows.length,
    viewerName: viewer.name, viewerImage: viewer.image,
  };
}

// Batch-load users (name + avatar) by id — the link confirmers plus the viewer.
// There is no confirmer relation on ChainLink, so we resolve the ids here. One query.
async function loadUsers(ids: Array<string | null | undefined>): Promise<ConfirmerMap> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, image: true } });
  return new Map(users.map((u) => [u.id, { name: u.name, image: u.image }]));
}

// The viewer's "Confirmed by" identity, with their avatar resolved from the map.
function resolveViewer(viewer: ExchangeViewer, users: ConfirmerMap): ResolvedViewer {
  const u = users.get(viewer.id);
  return { name: viewer.name ?? u?.name ?? null, image: u?.image ?? null };
}

// Every property photo path present on a set of links (for one batched sign).
function photoPathsOf(links: LinkForPush[]): Array<string | null | undefined> {
  return links.flatMap((l) => [l.transaction?.photoStoragePath, l.stubPhotoStoragePath]);
}

const seesAll = (scope: AccessScope) => scope.kind === "all" || scope.kind === "assigned";

// One file's exchange-push checklist. Returns null when the file isn't in push
// mode (not in a chain, not ready on both sides, or already exchanged) — the
// Overview panel renders only when this is non-null. Scope-guarded.
export async function getExchangePushForTransaction(
  transactionId: string,
  scope: AccessScope,
  viewer: ExchangeViewer,
): Promise<ExchangePush | null> {
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      agencyId: true,
      status: true,
      exchangedAt: true,
      chainLink: { select: { chainId: true } },
      milestoneCompletions: {
        where: { milestoneDefinition: { code: { in: READY_CODES } } },
        select: { state: true, milestoneDefinition: { select: { code: true } } },
      },
    },
  });
  if (!tx || tx.exchangedAt || isTerminalSale(tx.status) || !tx.chainLink?.chainId) return null;
  if (!bothSidesReady(tx)) return null;

  const links = await prisma.chainLink.findMany({
    where: { chainId: tx.chainLink.chainId },
    select: LINK_SELECT,
  }) as unknown as LinkForPush[];
  const [photoMap, users] = await Promise.all([
    getSignedUrlMap(photoPathsOf(links)),
    loadUsers([...links.map((l) => l.exchangeReadyConfirmedById), viewer.id]),
  ]);
  return assemble(tx.id, tx.propertyAddress, links, scope, viewer.id, seesAll(scope), tx.agencyId, resolveViewer(viewer, users), photoMap, users);
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
export async function listExchangePushForScope(scope: AccessScope, viewer: ExchangeViewer): Promise<ExchangePushSummary[]> {
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
  const linkList = links as unknown as (LinkForPush & { chainId: string })[];
  const [photoMap, users] = await Promise.all([
    getSignedUrlMap(photoPathsOf(linkList)),
    loadUsers([...linkList.map((l) => l.exchangeReadyConfirmedById), viewer.id]),
  ]);
  const resolvedViewer = resolveViewer(viewer, users);
  const byChain = new Map<string, LinkForPush[]>();
  for (const l of linkList) {
    const arr = byChain.get(l.chainId) ?? [];
    arr.push(l);
    byChain.set(l.chainId, arr);
  }

  const seeAll = seesAll(scope);
  const out: ExchangePushSummary[] = [];
  for (const t of ready) {
    const chainLinks = byChain.get(t.chainLink!.chainId) ?? [];
    const push = assemble(t.id, t.propertyAddress, chainLinks, scope, viewer.id, seeAll, t.agencyId, resolvedViewer, photoMap, users);
    out.push({ transactionId: t.id, address: t.propertyAddress, readyCount: push.readyCount, total: push.total, allReady: push.allReady, push });
  }
  // Closest to done first (highest ready share), all-ready at the very top.
  out.sort((a, b) => (b.readyCount / b.total) - (a.readyCount / a.total));
  return out;
}
