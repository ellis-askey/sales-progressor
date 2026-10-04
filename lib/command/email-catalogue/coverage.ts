// Completeness guard for the Email Catalogue (critique #180-B, part 1).
//
// KIND_COVERAGE maps EVERY taxonomy'd agent/system email kind (AgentEmailKind)
// to the catalogue specimen that represents it. Because it is typed as
// Record<AgentEmailKind, ...>, adding a new email kind WITHOUT mapping it here
// is a TypeScript error — so a new email can't silently skip the catalogue
// (the exact class of bug behind #180). coverageReport() turns it into the
// on-screen "X kinds · Y catalogued · Z missing" banner, and flags any mapping
// that points at a specimen id that no longer exists.
//
// Client-facing emails (the milestone matrix, portal messages, chases) are not
// AgentEmailKind-tagged — they ARE the catalogue's client specimens directly, so
// they don't appear here.

import "server-only";

import type { AgentEmailKind } from "@/lib/email/agent-log";
import { EMAIL_SPECIMENS } from "./registry";

type Coverage = { specimenId: string | null; note?: string };

const KIND_COVERAGE: Record<AgentEmailKind, Coverage> = {
  weekly_brief: { specimenId: "weekly-brief" },
  morning_digest: { specimenId: "morning-brief" },
  retention: { specimenId: "retention-activation_day_1", note: "represented by the retention series specimens" },
  booking_diary: { specimenId: "booking-diary" },
  booking_morning: { specimenId: "booking-morning" },
  welcome: { specimenId: null, note: "agency account welcome; not yet catalogued" },
  claim_welcome: { specimenId: "retention-claim_welcome" },
  team_invite: { specimenId: "team-invitation" },
  team_accepted: { specimenId: "team-joined" },
  portal_message: { specimenId: "portal-message-to-agent" },
  domain_auth: { specimenId: "domain-auth" },
  verified_email: { specimenId: "email-verification" },
  chain_invite: { specimenId: "chain-invite" },
  chain_invite_nudge: { specimenId: "chain-still-moving" },
  chain_neighbour_update: { specimenId: "chain-update" },
  chain_neighbour_chase: { specimenId: null, note: "chain neighbour chase; not yet catalogued" },
  milestone_agent: { specimenId: "milestone-agent" },
  milestone_progressor: { specimenId: "client-confirmed-progressor" },
  password_reset: { specimenId: "password-reset" },
  client_agent_setup: { specimenId: "progression-client-agent-invite" },
  teammate_setup: { specimenId: "progression-teammate-invite" },
};

export type CoverageReport = {
  total: number;
  catalogued: number;
  missing: { kind: string; note?: string }[];
  brokenRefs: { kind: string; specimenId: string }[];
};

export function coverageReport(): CoverageReport {
  const ids = new Set(EMAIL_SPECIMENS.map((s) => s.id));
  const entries = Object.entries(KIND_COVERAGE) as [AgentEmailKind, Coverage][];
  const missing = entries.filter(([, c]) => !c.specimenId).map(([kind, c]) => ({ kind, note: c.note }));
  const brokenRefs = entries
    .filter(([, c]) => c.specimenId && !ids.has(c.specimenId))
    .map(([kind, c]) => ({ kind, specimenId: c.specimenId as string }));
  return {
    total: entries.length,
    catalogued: entries.length - missing.length,
    missing,
    brokenRefs,
  };
}
