import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EventType } from "@prisma/client";

export type EventInput = {
  type: EventType;
  agencyId?: string;
  userId?: string;
  isInternalUser?: boolean;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Write an activity event to the unified Event table.
 *
 * Best-effort: failures are logged but never thrown — event writes must
 * never block or break the user-facing operation that triggered them.
 */
export async function recordEvent(input: EventInput): Promise<void> {
  try {
    await prisma.event.create({ data: input });
  } catch (err) {
    console.warn("[command/events] event_write_failed", {
      type: input.type,
      entityId: input.entityId,
      err,
    });
  }
}
