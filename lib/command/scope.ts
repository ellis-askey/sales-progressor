import type { ServiceType, AgencyModeProfile } from "@prisma/client";

export type CommandMode = "sp" | "pm" | "combined";

export interface CommandPreferences {
  mode: CommandMode;
  agencyIds: string[];
}

export function parseMode(raw: string | undefined): CommandMode {
  if (raw === "sp" || raw === "pm") return raw;
  return "combined";
}

export function parseAgencies(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}

// ─── DailyMetric scope helpers ────────────────────────────────────────────────

// Transaction-derived metrics (transactionsCreated, milestonesConfirmed, etc.)
// These live in rows keyed by serviceType.
export function serviceTypeScope(mode: CommandMode, agencyIds: string[] = []): {
  agencyId: string | null | { in: string[] };
  serviceType: ServiceType | null;
  modeProfile: null;
} {
  if (agencyIds.length > 0) {
    return { agencyId: { in: agencyIds }, serviceType: null, modeProfile: null };
  }
  if (mode === "sp") return { agencyId: null, serviceType: "self_managed", modeProfile: null };
  if (mode === "pm") return { agencyId: null, serviceType: "outsourced",   modeProfile: null };
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
  if (mode === "sp") return { agencyId: null, serviceType: null, modeProfile: "self_progressed"   };
  if (mode === "pm") return { agencyId: null, serviceType: null, modeProfile: "progressor_managed" };
  return { agencyId: null, serviceType: null, modeProfile: null };
}

// WeeklyCohort modeProfile filter
export function cohortModeFilter(mode: CommandMode): { modeProfile?: AgencyModeProfile } {
  if (mode === "sp") return { modeProfile: "self_progressed"    };
  if (mode === "pm") return { modeProfile: "progressor_managed" };
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
  if (mode !== "combined") p.set("mode", mode);
  if (agencyIds.length > 0) p.set("agency", agencyIds.join(","));
  const qs = p.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}
