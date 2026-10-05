// Business-level chase preferences for an EXTERNAL progression business.
//
// An external progressor works across many agencies' files, so the on/off choice
// for each chase category lives on the ProgressionBusiness (NOT the client agency,
// whose own Agency.* flags are its own defaults). Set by the owner in the first-run
// welcome modal and later in settings. Default ON.
//
// This module is the single read point for those prefs. Enforcement at the send
// paths (client-chase-cron, solicitor chases, enquiries, weekly update, chain
// updates) lands with the chase engines — each one, when a file is managed by a
// non-TSP business, will consult getProgressorChasePrefs before sending.
// lands: chase-engine enforcement PR (see EXTERNAL_SP_BACKLOG.md).

import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export type ProgressorChasePrefs = {
  client: boolean;    // nudge buyers/sellers to confirm steps in their portal
  solicitor: boolean; // chase solicitors to confirm the steps waiting on them
  enquiries: boolean; // chase solicitors to raise + reply to legal enquiries
  weekly: boolean;    // weekly reassurance note to each client
  chain: boolean;     // tell connected agents when a linked sale moves
};

export const DEFAULT_CHASE_PREFS: ProgressorChasePrefs = {
  client: true, solicitor: true, enquiries: true, weekly: true, chain: true,
};

/** The business's chase prefs. Defaults (all on) for an unknown id. */
export async function getProgressorChasePrefs(businessId: string): Promise<ProgressorChasePrefs> {
  const b = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: {
      chaseClientsEnabled: true,
      chaseSolicitorsEnabled: true,
      chaseEnquiriesEnabled: true,
      weeklyClientUpdatesEnabled: true,
      chainUpdatesEnabled: true,
    },
  });
  if (!b) return DEFAULT_CHASE_PREFS;
  return {
    client: b.chaseClientsEnabled,
    solicitor: b.chaseSolicitorsEnabled,
    enquiries: b.chaseEnquiriesEnabled,
    weekly: b.weeklyClientUpdatesEnabled,
    chain: b.chainUpdatesEnabled,
  };
}

// ── Enforcement (future-only) ────────────────────────────────────────────────
// Each chase send-path, for a file managed by a NON-TSP external business, consults
// the business's preference and skips that chase when it's off. Batch-loaded once per
// cron pass (no N+1): load the gate from the files' progressionBusinessIds, then check
// per file. A file with no business, or a TSP business, is never gated here — the
// engine's own rules apply unchanged.

export type BusinessChaseGate = Map<string, { isTsp: boolean } & ProgressorChasePrefs>;

export async function loadBusinessChaseGate(ids: Array<string | null | undefined>): Promise<BusinessChaseGate> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const gate: BusinessChaseGate = new Map();
  if (!unique.length) return gate;
  const rows = await prisma.progressionBusiness.findMany({
    where: { id: { in: unique } },
    select: {
      id: true, isTsp: true,
      chaseClientsEnabled: true, chaseSolicitorsEnabled: true, chaseEnquiriesEnabled: true,
      weeklyClientUpdatesEnabled: true, chainUpdatesEnabled: true,
    },
  });
  for (const r of rows) {
    gate.set(r.id, {
      isTsp: r.isTsp,
      client: r.chaseClientsEnabled, solicitor: r.chaseSolicitorsEnabled, enquiries: r.chaseEnquiriesEnabled,
      weekly: r.weeklyClientUpdatesEnabled, chain: r.chainUpdatesEnabled,
    });
  }
  return gate;
}

/** True unless a NON-TSP business manages this file AND has the given chase OFF. */
export function businessChaseAllows(
  gate: BusinessChaseGate,
  progressionBusinessId: string | null | undefined,
  category: keyof ProgressorChasePrefs,
): boolean {
  if (!progressionBusinessId) return true;
  const g = gate.get(progressionBusinessId);
  if (!g || g.isTsp) return true; // unknown or TSP → engine's own rules apply
  return g[category];
}

// The full automation settings for the owner's settings page: the 5 chase prefs plus
// the auto-chain-invites toggle (critique #23).
export type ProgressorAutomation = ProgressorChasePrefs & { autoChainInvites: boolean };

export async function getProgressorAutomation(businessId: string): Promise<ProgressorAutomation> {
  const b = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: {
      chaseClientsEnabled: true, chaseSolicitorsEnabled: true, chaseEnquiriesEnabled: true,
      weeklyClientUpdatesEnabled: true, chainUpdatesEnabled: true, autoChainInvitesEnabled: true,
    },
  });
  if (!b) return { ...DEFAULT_CHASE_PREFS, autoChainInvites: true };
  return {
    client: b.chaseClientsEnabled, solicitor: b.chaseSolicitorsEnabled, enquiries: b.chaseEnquiriesEnabled,
    weekly: b.weeklyClientUpdatesEnabled, chain: b.chainUpdatesEnabled, autoChainInvites: b.autoChainInvitesEnabled,
  };
}

export type ProgressorWelcomeState = {
  businessName: string;
  prefs: ProgressorChasePrefs;
};

/**
 * First-run welcome state for an EXTERNAL progression-business OWNER. Returns null
 * unless the viewer is a non-TSP progression-business owner who hasn't seen the
 * welcome yet, so the caller can mount the welcome modal. One query, run only for
 * owners (the caller already knows the viewer is one). TSP staff / agents never
 * qualify. The flag gate lives in the caller (layout), so this never runs with the
 * feature off.
 */
export async function getProgressorWelcomeState(session: Session): Promise<ProgressorWelcomeState | null> {
  if (session.user.role !== "sales_progressor") return null;
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      progressionBusinessRole: true,
      hasSeenProgressorWelcome: true,
      progressionBusiness: {
        select: {
          isTsp: true, name: true, shortName: true,
          chaseClientsEnabled: true,
          chaseSolicitorsEnabled: true,
          chaseEnquiriesEnabled: true,
          weeklyClientUpdatesEnabled: true,
          chainUpdatesEnabled: true,
        },
      },
    },
  });
  const b = me?.progressionBusiness;
  if (!b || b.isTsp) return null;
  if (me?.progressionBusinessRole !== "owner") return null;
  if (me?.hasSeenProgressorWelcome) return null;
  return {
    businessName: b.shortName || b.name,
    prefs: {
      client: b.chaseClientsEnabled,
      solicitor: b.chaseSolicitorsEnabled,
      enquiries: b.chaseEnquiriesEnabled,
      weekly: b.weeklyClientUpdatesEnabled,
      chain: b.chainUpdatesEnabled,
    },
  };
}
