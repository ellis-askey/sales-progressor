import { prisma } from "@/lib/prisma";

// Quiet usage tracking for the Boardwalk suite. Called from the withFormsAuth
// API gate on every authenticated request, but writes at most one
// FormAccessEvent row per user, per surface, per hour — enough to answer
// "has X been in, and when?" without logging noise or adding write load.
// Never throws: a logging failure must not fail the request it rides on.

const THROTTLE_MS = 60 * 60 * 1000; // one event per user+surface per hour

export type AccessSurface = "forms" | "todo";

export async function recordAccess(
  session: { userId: string; tenantId: string },
  surface: AccessSurface
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - THROTTLE_MS);
    const recent = await prisma.formAccessEvent.findFirst({
      where: { userId: session.userId, surface, createdAt: { gt: cutoff } },
      select: { id: true },
    });
    if (recent) return;

    await prisma.formAccessEvent.create({
      data: { tenantId: session.tenantId, userId: session.userId, surface },
    });
    await prisma.formTenantUser.update({
      where: { id: session.userId },
      data: { lastSeenAt: new Date() },
    });
  } catch (err) {
    console.error("[forms-access-log]", err);
  }
}

/** Surface for a request URL handled by the Boardwalk API. */
export function surfaceForPath(pathname: string): AccessSurface {
  return pathname.startsWith("/api/todo") ? "todo" : "forms";
}
