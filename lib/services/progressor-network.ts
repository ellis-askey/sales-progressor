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
  /** Coverage + specialism chips. */
  tags: string[];
  /** The viewing agency's relationship to this business. */
  connectionStatus: ProgressorConnectionStatus;
  /** True when the agency connected to this business via the network (monetization provenance). */
  viaNetwork: boolean;
  /** Whether the viewing agency has saved this business. */
  saved: boolean;
};

export type ProgressorNetworkData = {
  businesses: ProgressorNetworkBusiness[];
};

// Controlled vocabularies — the single source of truth for the filter facets AND
// the per-business profile picker, so chips never drift. A business's
// networkSpecialisms / networkRegions store a subset of these. Extend in ONE
// place (here). Founders curate per business for now; businesses self-serve
// from the same lists later.
export const NETWORK_SPECIALISMS = [
  "Leasehold",
  "New-build",
  "Chain management",
  "High-value",
  "First-time buyers",
  "Shared ownership",
  "Auction sales",
  "Probate / executor sales",
] as const;

export const NETWORK_REGIONS = [
  "Nationwide",
  "London",
  "South East",
  "South West",
  "Midlands",
  "North",
  "Scotland",
  "Wales",
] as const;

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
  const [stats, links] = await Promise.all([
    getNetworkStatsFor(ids),
    agencyId
      ? prisma.progressionBusinessClient.findMany({
          where: { agencyId, progressionBusinessId: { in: ids }, removedAt: null },
          select: { progressionBusinessId: true },
        })
      : Promise.resolve([] as { progressionBusinessId: string }[]),
  ]);
  const connected = new Set(links.map((l) => l.progressionBusinessId));

  const businesses: ProgressorNetworkBusiness[] = rows.map((r) => ({
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
    connectionStatus: connected.has(r.id) ? "connected" : "none",
    viaNetwork: false, // provenance flag lands with the P2 connect funnel
    saved: false, // saved persistence lands in a later phase; in-session only for now
  }));

  return { businesses };
}
