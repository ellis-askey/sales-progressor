// Outreach objective-function metrics (Build Order D). Computed entirely from
// EXISTING data: ProspectEmail (delivery diagnostics), Prospect.status, and
// Prospect.convertedAgencyId -> Agency -> PropertyTransaction (conversion depth).
//
// Objective ordering (deepest reliable behavioural objective = ACTIVATED AGENCY):
//   sent -> delivered -> reply -> interested (positive reply proxy)
//   -> convertedToAgency (signup) -> activatedAgency (>=1 genuine sale)
//   -> furtherActivity (>=2 genuine sales) -> exchanged/revenue (sparse).
// Opens/clicks are DIAGNOSTIC leading indicators only, never the objective.
//
// "Genuine" transaction = isDemo=false AND isMigrated=false (matches the schema's
// own definition of "activated"). Genuine agency = isInternal=false, isDemo=false.

import { commandDb } from "@/lib/command/prisma";
import { compareVariants, maturityLabel, type Comparison, type MaturityLabel } from "./stats";
import { SEGMENT_DIMENSIONS, segmentValue, type SegmentDimension } from "./segments";

const INTERESTED_STATUSES = new Set(["interested", "trial", "active"]);

export type ObjectiveFunnel = {
  totalProspects: number;
  contacted: number;
  replied: number;
  interested: number; // positive/interested reply proxy (status interested+)
  convertedToAgency: number; // signup
  activatedAgency: number; // converted + >=1 genuine sale — the deepest reliable objective
  furtherActivity: number; // activated agencies with >=2 genuine sales
};

export type OutreachMetrics = {
  diagnostics: {
    emailsSent: number;
    delivered: number;
    opened: number; // diagnostic only
    clicked: number; // diagnostic only
    deliveredRate: number;
    openRate: number; // diagnostic only
    clickRate: number; // diagnostic only
  };
  funnel: ObjectiveFunnel;
  revenue: {
    exchangedGenuineTransactions: number;
    billedGenuineTransactions: number;
    note: string;
  };
};

type FunnelRow = {
  source: string | null;
  groupId: string | null;
  followUpCount: number;
  lastContactedAt: Date | null;
  postcode: string | null;
  status: string;
  convertedAgencyId: string | null;
  hasReplied: boolean;
  activation: "none" | "activated" | "further";
};

// Resolve the outreach-ATTRIBUTED agencies (agencies a prospect converted to,
// excluding internal) and their genuine (non-demo, non-migrated) transaction
// counts. Attribution is strict: only agencies reachable via a prospect's
// convertedAgencyId are considered. General platform transactions/revenue are
// NEVER attributed to outreach. (Agency has no isDemo field; isInternal is the
// only agency-level exclusion, and the transaction filter removes demo sales.)
async function resolveConvertedAgencies(
  convertedIds: string[],
): Promise<{ genuineAgencyIds: string[]; txCount: Map<string, number> }> {
  if (!convertedIds.length) return { genuineAgencyIds: [], txCount: new Map() };
  const genuine = await commandDb.agency.findMany({
    where: { id: { in: convertedIds }, isInternal: false },
    select: { id: true },
  });
  const genuineAgencyIds = genuine.map((a) => a.id);
  if (!genuineAgencyIds.length) return { genuineAgencyIds: [], txCount: new Map() };
  const grouped = await commandDb.propertyTransaction.groupBy({
    by: ["agencyId"],
    where: { agencyId: { in: genuineAgencyIds }, isDemo: false, isMigrated: false },
    _count: { _all: true },
  });
  return { genuineAgencyIds, txCount: new Map(grouped.map((g) => [g.agencyId, g._count._all])) };
}

function activationFrom(
  txCount: Map<string, number>,
  genuineSet: Set<string>,
  agencyId: string | null,
): "none" | "activated" | "further" {
  if (!agencyId || !genuineSet.has(agencyId)) return "none";
  const n = txCount.get(agencyId) ?? 0;
  return n >= 2 ? "further" : n >= 1 ? "activated" : "none";
}

async function loadFunnelData(): Promise<{ rows: FunnelRow[]; genuineAgencyIds: string[] }> {
  const prospects = await commandDb.prospect.findMany({
    select: {
      source: true,
      groupId: true,
      followUpCount: true,
      lastContactedAt: true,
      postcode: true,
      status: true,
      convertedAgencyId: true,
      emails: { where: { repliedAt: { not: null } }, select: { id: true }, take: 1 },
    },
  });

  const convertedIds = prospects
    .map((p) => p.convertedAgencyId)
    .filter((id): id is string => !!id);
  const { genuineAgencyIds, txCount } = await resolveConvertedAgencies(convertedIds);
  const genuineSet = new Set(genuineAgencyIds);

  const rows: FunnelRow[] = prospects.map((p) => ({
    source: p.source,
    groupId: p.groupId,
    followUpCount: p.followUpCount,
    lastContactedAt: p.lastContactedAt,
    postcode: p.postcode,
    status: p.status,
    convertedAgencyId: p.convertedAgencyId,
    hasReplied: p.emails.length > 0,
    activation: activationFrom(txCount, genuineSet, p.convertedAgencyId),
  }));
  return { rows, genuineAgencyIds };
}

function buildFunnel(rows: FunnelRow[]): ObjectiveFunnel {
  const f: ObjectiveFunnel = {
    totalProspects: rows.length,
    contacted: 0,
    replied: 0,
    interested: 0,
    convertedToAgency: 0,
    activatedAgency: 0,
    furtherActivity: 0,
  };
  for (const r of rows) {
    if (r.lastContactedAt || r.followUpCount > 0) f.contacted++;
    if (r.hasReplied) f.replied++;
    if (INTERESTED_STATUSES.has(r.status)) f.interested++;
    if (r.convertedAgencyId) f.convertedToAgency++;
    if (r.activation === "activated" || r.activation === "further") f.activatedAgency++;
    if (r.activation === "further") f.furtherActivity++;
  }
  return f;
}

export async function getOutreachMetrics(): Promise<OutreachMetrics> {
  const [{ rows, genuineAgencyIds }, emailsSent, delivered, opened, clicked] = await Promise.all([
    loadFunnelData(),
    commandDb.prospectEmail.count(),
    commandDb.prospectEmail.count({ where: { deliveredAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { openedAt: { not: null } } }),
    commandDb.prospectEmail.count({ where: { clickedAt: { not: null } } }),
  ]);

  // Revenue is ATTRIBUTED, never platform-wide: only transactions belonging to
  // agencies that were converted from a prospect count towards outreach revenue.
  const [exchanged, billed] = genuineAgencyIds.length
    ? await Promise.all([
        commandDb.propertyTransaction.count({
          where: { agencyId: { in: genuineAgencyIds }, isDemo: false, isMigrated: false, exchangedAt: { not: null } },
        }),
        commandDb.propertyTransaction.count({
          where: { agencyId: { in: genuineAgencyIds }, isDemo: false, isMigrated: false, billedAtExchange: { not: null } },
        }),
      ])
    : [0, 0];

  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    diagnostics: {
      emailsSent,
      delivered,
      opened,
      clicked,
      deliveredRate: rate(delivered, emailsSent),
      openRate: rate(opened, emailsSent),
      clickRate: rate(clicked, emailsSent),
    },
    funnel: buildFunnel(rows),
    revenue: {
      exchangedGenuineTransactions: exchanged,
      billedGenuineTransactions: billed,
      note: "Outreach-ATTRIBUTED only (transactions of agencies converted from a prospect); never platform-wide totals. Revenue is sparse pre-launch (self-progress free, first outsourced file free) and is tracked, not optimised, in V1.",
    },
  };
}

export type SegmentFunnel = { segment: string; funnel: ObjectiveFunnel; maturity: MaturityLabel };

export async function getSegmentFunnels(dimension: SegmentDimension): Promise<SegmentFunnel[]> {
  const { rows } = await loadFunnelData();
  const buckets = new Map<string, FunnelRow[]>();
  for (const r of rows) {
    const key = segmentValue(dimension, r);
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  return Array.from(buckets.entries())
    .map(([segment, rs]) => ({ segment, funnel: buildFunnel(rs), maturity: maturityLabel(rs.length) }))
    .sort((a, b) => b.funnel.totalProspects - a.funnel.totalProspects);
}

export async function getAllSegmentFunnels(): Promise<Record<SegmentDimension, SegmentFunnel[]>> {
  const out = {} as Record<SegmentDimension, SegmentFunnel[]>;
  for (const dim of SEGMENT_DIMENSIONS) out[dim] = await getSegmentFunnels(dim);
  return out;
}

// ── Experiment / variant rollups ────────────────────────────────────────────

// Map an experiment's primary-metric string to the funnel stage it measures.
function stageReached(metric: string, row: { hasReplied: boolean; status: string; convertedAgencyId: string | null; activation: string }): boolean {
  switch (metric) {
    case "reply":
      return row.hasReplied;
    case "positive_reply":
    case "interested":
      return INTERESTED_STATUSES.has(row.status);
    case "converted":
    case "signup":
      return !!row.convertedAgencyId;
    case "activated_agency":
    case "activated":
      return row.activation === "activated" || row.activation === "further";
    default:
      // Unknown metric: fall back to the deepest reliable objective.
      return row.activation === "activated" || row.activation === "further";
  }
}

export type VariantRollup = {
  variantId: string;
  role: string;
  name: string;
  exposure: number;
  successes: number;
  rate: number;
  maturity: MaturityLabel;
};

export type ExperimentRollup = {
  experimentId: string;
  primaryMetric: string;
  variants: VariantRollup[];
  comparison: Comparison | null; // null unless exactly one control + one challenger
};

export async function getExperimentRollup(experimentId: string): Promise<ExperimentRollup | null> {
  const experiment = await commandDb.outreachExperiment.findUnique({
    where: { id: experimentId },
    select: { id: true, primaryMetric: true, variants: { select: { id: true, role: true, name: true } } },
  });
  if (!experiment) return null;
  const metric = experiment.primaryMetric ?? "activated_agency";

  // Assignments join prospect -> variant; pull the prospect signals we need, with
  // replied scoped to THIS experiment's emails so attribution is exact.
  const assignments = await commandDb.outreachAssignment.findMany({
    where: { experimentId },
    select: {
      variantId: true,
      prospect: {
        select: {
          status: true,
          convertedAgencyId: true,
          emails: { where: { experimentId, repliedAt: { not: null } }, select: { id: true }, take: 1 },
        },
      },
    },
  });

  // Resolve activation for the converted agencies among assigned prospects.
  const convertedIds = assignments
    .map((a) => a.prospect.convertedAgencyId)
    .filter((id): id is string => !!id);
  const { genuineAgencyIds, txCount } = await resolveConvertedAgencies(convertedIds);
  const genuineSet = new Set(genuineAgencyIds);
  const activationOf = (agencyId: string | null): string => activationFrom(txCount, genuineSet, agencyId);

  const tally = new Map<string, { exposure: number; successes: number }>();
  for (const a of assignments) {
    const t = tally.get(a.variantId) ?? { exposure: 0, successes: 0 };
    t.exposure++;
    const reached = stageReached(metric, {
      hasReplied: a.prospect.emails.length > 0,
      status: a.prospect.status,
      convertedAgencyId: a.prospect.convertedAgencyId,
      activation: activationOf(a.prospect.convertedAgencyId),
    });
    if (reached) t.successes++;
    tally.set(a.variantId, t);
  }

  const variants: VariantRollup[] = experiment.variants.map((v) => {
    const t = tally.get(v.id) ?? { exposure: 0, successes: 0 };
    return {
      variantId: v.id,
      role: v.role,
      name: v.name,
      exposure: t.exposure,
      successes: t.successes,
      rate: t.exposure > 0 ? t.successes / t.exposure : 0,
      maturity: maturityLabel(t.exposure),
    };
  });

  const control = variants.find((v) => v.role === "control");
  const challenger = variants.find((v) => v.role === "challenger");
  const comparison =
    variants.length === 2 && control && challenger
      ? compareVariants(
          { key: "control", successes: control.successes, total: control.exposure },
          { key: "challenger", successes: challenger.successes, total: challenger.exposure },
        )
      : null;

  return { experimentId, primaryMetric: metric, variants, comparison };
}
