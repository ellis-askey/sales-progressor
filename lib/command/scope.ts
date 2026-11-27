import type { ServiceType, AgencyModeProfile, Prisma } from "@prisma/client";

// The Command Centre's primary lens is BUSINESS TYPE, not the old SP/PM axis:
//
//   all      — everything (estate agencies + external progression companies)
//   agents   — estate agencies running their own sales (self-managed)
//   external — sales run by progression companies (outsourced)
//
// TSP's own outsourced book has its own home (/command/tsp-outsourced) and is
// being wound down. On LIVE-transaction surfaces the external slice can exclude
// TSP cleanly (progressionBusinessId not null). On ROLLUP surfaces (DailyMetric
// / WeeklyCohort) it CANNOT — those tables have no business dimension, so
// "external" there is the whole `outsourced` serviceType, which still includes
// the dwindling TSP book until that page is moved to a live read. See
// docs/active/tsp-outsourced-hub/00-plan.md (decision 3).
export type CommandMode = "all" | "agents" | "external";

export interface CommandPreferences {
  mode: CommandMode;
  agencyIds: string[];
}

export function parseMode(raw: string | undefined): CommandMode {
  if (raw === "agents" || raw === "external") return raw;
  // Back-compat: the retired sp/pm/combined axis maps onto the new one so old
  // saved preferences and bookmarked URLs keep working.
  if (raw === "sp") return "agents";
  if (raw === "pm") return "external";
  return "all";
}

export function parseAgencies(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

// ─── DailyMetric scope helpers ────────────────────────────────────────────────

// Transaction-derived metrics (transactionsCreated, milestonesConfirmed, etc.)
// These live in rows keyed by serviceType. "external" maps to the `outsourced`
// serviceType (the rollup can't isolate external from TSP — see header note).
export function serviceTypeScope(mode: CommandMode, agencyIds: string[] = []): {
  agencyId: string | null | { in: string[] };
  serviceType: ServiceType | null;
  modeProfile: null;
} {
  if (agencyIds.length > 0) {
    return { agencyId: { in: agencyIds }, serviceType: null, modeProfile: null };
  }
  if (mode === "agents")   return { agencyId: null, serviceType: "self_managed", modeProfile: null };
  if (mode === "external") return { agencyId: null, serviceType: "outsourced",   modeProfile: null };
  return { agencyId: null, serviceType: null, modeProfile: null };
}

// Agency-derived metrics (signups, logins, uniqueActiveUsers)
// These live in rows keyed by modeProfile.
export function modeProfileScope(mode: CommandMode, agencyIds: string[] = []): {
  agencyId: string | null | { in: string[] };
  serviceType: null;
  modeProfile: AgencyModeProfile | null;
} {
  if (agencyIds.length > 0) {
    return { agencyId: { in: agencyIds }, serviceType: null, modeProfile: null };
  }
  if (mode === "agents")   return { agencyId: null, serviceType: null, modeProfile: "self_progressed"   };
  if (mode === "external") return { agencyId: null, serviceType: null, modeProfile: "progressor_managed" };
  return { agencyId: null, serviceType: null, modeProfile: null };
}

// Live-transaction counterpart to serviceTypeScope, for base-table reads that
// must honour the business-type lens AND cleanly exclude TSP's own outsourced
// book (the DailyMetric rollup can't — it has no business dimension). Compose
// with the caller's own base excludes (demo / internal / migrated etc.):
//   `{ ...txBase, ...businessTxWhere(mode, agencyIds) }`
// or, for a related model: `transaction: { ...txBase, ...businessTxWhere(...) }`.
export function businessTxWhere(mode: CommandMode, agencyIds: string[] = []): Prisma.PropertyTransactionWhereInput {
  // A selected agency wins over the mode toggle (same precedence as the rollup
  // helpers); TSP's own book is excluded regardless.
  if (agencyIds.length > 0) {
    return { agencyId: { in: agencyIds }, NOT: { serviceType: "outsourced", progressionBusinessId: null } };
  }
  if (mode === "agents")   return { serviceType: "self_managed", progressionBusinessId: null };
  if (mode === "external") return { progressionBusinessId: { not: null } };
  // all: everything except TSP's own outsourced book.
  return { NOT: { serviceType: "outsourced", progressionBusinessId: null } };
}

// WeeklyCohort modeProfile filter
export function cohortModeFilter(mode: CommandMode): { modeProfile?: AgencyModeProfile } {
  if (mode === "agents")   return { modeProfile: "self_progressed"    };
  if (mode === "external") return { modeProfile: "progressor_managed" };
  return {};
}

// ─── Event scope helpers ──────────────────────────────────────────────────────

// For Event table — agencyId filter.
// When agencyIds is non-empty, filter directly.
// When mode is set (no agency override), caller must pass the pre-resolved agency ID list.
export function eventScope(agencyIds: string[]): { agencyId?: { in: string[] } } {
  if (agencyIds.length === 0) return {};
  return { agencyId: { in: agencyIds } };
}

// ─── URL building ─────────────────────────────────────────────────────────────

export function buildFilterUrl(
  base: string,
  mode: CommandMode,
  agencyIds: string[],
  extra: Record<string, string> = {}
): string {
  const p = new URLSearchParams(extra);
  if (mode !== "all") p.set("mode", mode);
  if (agencyIds.length > 0) p.set("agency", agencyIds.join(","));
  const qs = p.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}
