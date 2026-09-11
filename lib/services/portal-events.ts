import { Prisma } from "@prisma/client";
import type { EventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";

/**
 * Emit a client-side portal engagement event into the unified Event table
 * (Portal Engagement v2, Phase 1). Best-effort and safe to fire-and-forget on a
 * render path: it resolves its own context, never throws, and never blocks.
 *
 * Client contacts are not User rows, so we key on the Contact:
 *   entityType = "Contact", entityId = contactId,
 *   agencyId   = the file's agency (for Command Centre scoping),
 *   isInternalUser = false,
 *   metadata   = { transactionId, side, ...event-specific }.
 *
 * `side` ("vendor" | "purchaser") is stamped on EVERY event so buyer vs seller —
 * and, later, household (a side counts as engaged if either principal is) — can
 * be split. See docs/active/portal-engagement-v2/phase-1-spec.md.
 */
export async function recordPortalEvent(
  type: EventType,
  contactId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const c = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        roleType: true,
        propertyTransactionId: true,
        transaction: { select: { agencyId: true } },
      },
    });
    if (!c) return;
    const side = c.roleType === "vendor" ? "vendor" : "purchaser";
    await recordEvent({
      type,
      agencyId: c.transaction?.agencyId,
      isInternalUser: false,
      entityType: "Contact",
      entityId: contactId,
      metadata: {
        transactionId: c.propertyTransactionId,
        side,
        ...metadata,
      } as Prisma.InputJsonValue,
    });
  } catch {
    // Best-effort: portal engagement telemetry must never break a render.
  }
}
