// Per-agency solicitor CC resolution (Fix 1, 2026-09-13).
//
// A solicitor handler (SolicitorContact) is a SHARED directory row. Its assistant
// / CC email has two possible sources with a strict precedence:
//
//   1. The solicitor's OWN value — SolicitorContact.secondaryEmail, set by the
//      solicitor in their own portal. This is GOSPEL: when present it is used for
//      EVERY agency, always, and an agency cannot override it. Keeping it current
//      is the solicitor's responsibility.
//   2. Otherwise, the AGENCY's own override — SolicitorContactAgencyOverride,
//      private to that agency and never seen or changed by another agency.
//   3. Otherwise, no CC.
//
// This closes the shared-directory cross-agency issue: an agency's CC edit only
// ever touches its own override row, so it can never change another agency's
// (or the solicitor's) CC. Every send path resolves through here.

import { prisma } from "@/lib/prisma";

export type SolicitorCcSource = "solicitor" | "agency" | "none";

function clean(v: string | null | undefined): string | null {
  const t = v?.trim().toLowerCase();
  return t ? t : null;
}

/**
 * Resolve the CC email to use for a handler when sending on behalf of `agencyId`.
 * Precedence: solicitor's own value (gospel) → this agency's override → none.
 */
export async function resolveSolicitorCc(
  handler: { id: string; secondaryEmail: string | null } | null | undefined,
  agencyId: string | null | undefined,
): Promise<string | null> {
  if (!handler) return null;
  const gospel = clean(handler.secondaryEmail);
  if (gospel) return gospel;
  if (!agencyId) return null;
  const override = await prisma.solicitorContactAgencyOverride.findUnique({
    where: { agencyId_solicitorContactId: { agencyId, solicitorContactId: handler.id } },
    select: { secondaryEmail: true },
  });
  return clean(override?.secondaryEmail);
}

/**
 * UI helper: what CC applies for this agency, its source, and whether the agent
 * may edit it. When the solicitor has set their own gospel value, the agent sees
 * it read-only ("set by the solicitor"); otherwise the agent edits their agency's
 * own override.
 */
export async function getSolicitorCcForEditing(
  handler: { id: string; secondaryEmail: string | null },
  agencyId: string | null | undefined,
): Promise<{ source: SolicitorCcSource; value: string | null; editable: boolean }> {
  const gospel = clean(handler.secondaryEmail);
  if (gospel) return { source: "solicitor", value: gospel, editable: false };
  if (!agencyId) return { source: "none", value: null, editable: false };
  const override = await prisma.solicitorContactAgencyOverride.findUnique({
    where: { agencyId_solicitorContactId: { agencyId, solicitorContactId: handler.id } },
    select: { secondaryEmail: true },
  });
  return { source: "agency", value: clean(override?.secondaryEmail), editable: true };
}

/**
 * Set (or clear) an agency's own CC override for a handler. No-ops the write when
 * the solicitor has a gospel value set (the agency value would never be used), so
 * we don't store misleading data — the caller should surface that to the agent.
 * Returns the value stored (or null), or throws GOSPEL_SET if blocked.
 */
export const SOLICITOR_CC_GOSPEL_SET = "SOLICITOR_CC_GOSPEL_SET";

export async function setAgencySolicitorCc(
  handler: { id: string; secondaryEmail: string | null },
  agencyId: string,
  secondaryEmail: string | null,
): Promise<string | null> {
  if (clean(handler.secondaryEmail)) {
    // The solicitor's own value is gospel — an agency override can't apply.
    throw new Error(SOLICITOR_CC_GOSPEL_SET);
  }
  const value = clean(secondaryEmail);
  await prisma.solicitorContactAgencyOverride.upsert({
    where: { agencyId_solicitorContactId: { agencyId, solicitorContactId: handler.id } },
    create: { agencyId, solicitorContactId: handler.id, secondaryEmail: value },
    update: { secondaryEmail: value },
  });
  return value;
}
