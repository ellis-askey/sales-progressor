// Progressor Network — the marketplace of independent sales-progression
// businesses an agency can discover and connect to.
//
// Live data: reads the ProgressionBusiness rows flagged networkListed, folds in
// the VERIFIED performance stats computed from each business's transactions
// (getNetworkStatsFor), and marks which the viewing agency is already connected
// to (an active ProgressionBusinessClient link). The declared profile (tagline,
// blurb, logo, regions, specialisms, availability) lives on the business row;
// the performance stats are never declared. See docs/active/progressor-network/SPEC.md.

import { prisma } from "@/lib/prisma";
import { getNetworkStatsFor } from "@/lib/services/progressor-network-stats";
import { connectRequestCutoff } from "@/lib/services/progression-clients";

export type ProgressorNetworkTab =
  | "discover"
  | "my-progressors"
  | "introductions"
  | "saved";

export type ProgressorAvailability = "accepting" | "limited" | "closed";

export type ProgressorConnectionStatus = "none" | "requested" | "connected";

export type ProgressorCardStats = {
  /** Completion rate: of resolved sales (reached exchange, or withdrawn without exchanging), the share that reached exchange. Sale-based (rescued relists count as wins). null until the warm-up threshold. */
  completionRatePct: number | null;
  /** Exchanges in the trailing 12 months. */
  exchangedFiles12mo: number | null;
  /** Typical offer-to-exchange time, in weeks. Replaces the confidential "typical fee". */
  avgTimeToExchangeWeeks: number | null;
  /** Active team members (owner + progressors). */
  teamSize: number;
};

export type ProgressorNetworkBusiness = {
  id: string;
  name: string;
  /** Short strapline under the name. */
  kind: string;
  /** One or two line pitch. */
  blurb: string;
  /** Initials shown in the brand tile when there's no logo. */
  monogram: string;
  /** Brand tile colour (hex) — the monogram-tile background. */
  brandColor: string;
  /** Logo URL/path; when set the card shows the logo instead of the monogram. */
  logoPath?: string | null;
  availability: ProgressorAvailability;
  stats: ProgressorCardStats;
  /** Coverage + specialism chips (regions then specialisms), for the card. */
  tags: string[];
  /** Coverage regions, on their own (for the storefront Overview). */
  regions: string[];
  /** Specialisms, on their own (for the storefront Overview). */
  specialisms: string[];
  /** The viewing agency's relationship to this business. */
  connectionStatus: ProgressorConnectionStatus;
  /** Pending network request id when connectionStatus is "requested" (for withdraw). */
  requestId: string | null;
  /** True when the agency connected to this business via the network (monetization provenance). */
  viaNetwork: boolean;
  /** Whether the viewing agency has saved this business. */
  saved: boolean;
};

export type ProgressorNetworkData = {
  businesses: ProgressorNetworkBusiness[];
};

// Controlled vocabularies now live in a client-safe module (so client components
// can import them without pulling this server service — and next/headers — into
// the client bundle). Re-exported here for existing server-side importers.
export { NETWORK_SPECIALISMS, NETWORK_REGIONS } from "./progressor-network-constants";

const DEFAULT_BRAND_COLOR = "#334155"; // slate — monogram-tile fallback when no brand colour set
const EMPTY_STATS: ProgressorCardStats = {
  completionRatePct: null,
  exchangedFiles12mo: null,
  avgTimeToExchangeWeeks: null,
  teamSize: 0,
};

/** Initials for the monogram tile: first + last word, else first two letters. */
function monogramOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function normaliseAvailability(v: string | null): ProgressorAvailability {
  return v === "limited" || v === "closed" ? v : "accepting";
}

/**
 * Returns the network catalogue for the viewing agency: every listed business,
 * with its computed stats and this agency's connection state.
 */
export async function getProgressorNetwork(
  agencyId: string | null,
): Promise<ProgressorNetworkData> {
  const rows = await prisma.progressionBusiness.findMany({
    where: { networkListed: true },
    select: {
      id: true,
      name: true,
      shortName: true,
      networkTagline: true,
      networkBlurb: true,
      networkLogoPath: true,
      networkBrandColor: true,
      networkRegions: true,
      networkSpecialisms: true,
      networkAvailability: true,
    },
    orderBy: { name: "asc" },
  });

  const ids = rows.map((r) => r.id);
  const [stats, links, pendingRequests, saves] = await Promise.all([
    getNetworkStatsFor(ids),
    agencyId
      ? prisma.progressionBusinessClient.findMany({
          where: { agencyId, progressionBusinessId: { in: ids }, removedAt: null },
          select: { progressionBusinessId: true, source: true },
        })
      : Promise.resolve([] as { progressionBusinessId: string; source: string | null }[]),
    agencyId
      ? prisma.progressionConnectionRequest.findMany({
          where: {
            agencyId,
            progressionBusinessId: { in: ids },
            initiatedBy: "agency",
            status: "pending",
            createdAt: { gte: connectRequestCutoff() },
          },
          select: { id: true, progressionBusinessId: true },
        })
      : Promise.resolve([] as { id: string; progressionBusinessId: string }[]),
    agencyId
      ? prisma.progressionNetworkSave.findMany({
          where: { agencyId, progressionBusinessId: { in: ids } },
          select: { progressionBusinessId: true },
        })
      : Promise.resolve([] as { progressionBusinessId: string }[]),
  ]);
  const linkByBiz = new Map(links.map((l) => [l.progressionBusinessId, l]));
  const pendingByBiz = new Map(pendingRequests.map((r) => [r.progressionBusinessId, r.id]));
  const savedBiz = new Set(saves.map((s) => s.progressionBusinessId));

  const businesses: ProgressorNetworkBusiness[] = rows.map((r) => {
    const link = linkByBiz.get(r.id);
    const pendingReqId = pendingByBiz.get(r.id) ?? null;
    const connectionStatus: ProgressorConnectionStatus = link ? "connected" : pendingReqId ? "requested" : "none";
    return {
      id: r.id,
      name: r.name,
      kind: r.networkTagline ?? "Independent sales progression business",
      blurb: r.networkBlurb ?? "",
      monogram: monogramOf(r.shortName ?? r.name),
      brandColor: r.networkBrandColor ?? DEFAULT_BRAND_COLOR,
      logoPath: r.networkLogoPath,
      availability: normaliseAvailability(r.networkAvailability),
      stats: stats.get(r.id) ?? EMPTY_STATS,
      tags: [...r.networkRegions, ...r.networkSpecialisms],
      regions: r.networkRegions,
      specialisms: r.networkSpecialisms,
      connectionStatus,
      requestId: connectionStatus === "requested" ? pendingReqId : null,
      viaNetwork: link?.source === "network",
      saved: savedBiz.has(r.id),
    };
  });

  return { businesses };
}

/**
 * Toggle an agency's bookmark of a network-listed business (the Saved tab).
 * Idempotent per direction: saving an already-saved business is a no-op, and
 * unsaving an unsaved one likewise. Returns the resulting saved state. Only
 * network-listed businesses can be saved. Scoped to the caller's own agencyId.
 */
export async function toggleProgressorSave(input: {
  agencyId: string;
  businessId: string;
  savedByUserId: string;
}): Promise<{ ok: true; saved: boolean } | { ok: false; error: string }> {
  const biz = await prisma.progressionBusiness.findUnique({
    where: { id: input.businessId },
    select: { id: true, networkListed: true, isTsp: true },
  });
  if (!biz || biz.isTsp || !biz.networkListed) return { ok: false, error: "That business can't be saved." };

  const existing = await prisma.progressionNetworkSave.findUnique({
    where: { agencyId_progressionBusinessId: { agencyId: input.agencyId, progressionBusinessId: biz.id } },
    select: { id: true },
  });
  if (existing) {
    await prisma.progressionNetworkSave.delete({ where: { id: existing.id } });
    return { ok: true, saved: false };
  }
  await prisma.progressionNetworkSave.create({
    data: { agencyId: input.agencyId, progressionBusinessId: biz.id, savedByUserId: input.savedByUserId },
  });
  return { ok: true, saved: true };
}
