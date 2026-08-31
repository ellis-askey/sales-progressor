import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isAgentTheme } from "@/lib/agent/themes";

export async function GET() {
  const session = await requireSession();
  const userId = session.user.id;
  const agencyId = session.user.agencyId;

  // All checks scoped to this agent's own files
  const agentTxWhere = { agentUserId: userId, agencyId, status: { not: "draft" as const } };

  const [activeTxCount, contactWithDetails, contactWithEmail, verifiedEmail, user, firstTx, verifiedDomainCount, inboundConnectionCount] =
    await Promise.all([
      prisma.propertyTransaction.count({ where: agentTxWhere }),
      prisma.contact.count({
        where: {
          transaction: agentTxWhere,
          OR: [{ phone: { not: null } }, { email: { not: null } }],
        },
      }),
      prisma.contact.count({
        where: { transaction: agentTxWhere, email: { not: null } },
      }),
      prisma.userVerifiedEmail.count({
        where: { userId, status: "verified" },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { phone: true, agentPreferences: true, createdAt: true } }),
      prisma.propertyTransaction.findFirst({
        where: agentTxWhere,
        orderBy: { createdAt: "asc" },
        select: { id: true },
      }),
      // Agency sending domain authenticated (DKIM + SPF verified). Same "ready"
      // signal the Command Centre agency readiness view uses. Sender auto-adopts
      // the domain on verify, so a verified domain is the single source of truth.
      // Non-agency users (agencyId null) never match and stay false.
      prisma.verifiedDomain.count({ where: { agencyId: agencyId ?? "__none__", status: "verified" } }),
      // Email inbox connected: at least one OutlookConnection for this user. Drives
      // agents to link their inbox on the new /agent/account/connections page.
      prisma.outlookConnection.count({ where: { userId } }),
    ]);

  // Explicit theme choice: agentPreferences.theme must exist and be a valid theme.
  // agentPreferences: null means the user has never touched the picker.
  // After 14 days we stop requiring it — they've had ample time; default Sunset is fine.
  const THEME_GRACE_MS = 14 * 24 * 60 * 60 * 1000;
  const accountAgeMs = Date.now() - (user?.createdAt?.getTime() ?? Date.now());
  const prefs = user?.agentPreferences;
  const hasThemeSet = accountAgeMs > THEME_GRACE_MS || !!(
    prefs &&
    typeof prefs === "object" &&
    "theme" in prefs &&
    isAgentTheme((prefs as Record<string, unknown>).theme)
  );

  return NextResponse.json({
    progress: {
      hasThemeSet,
      hasSale:            activeTxCount > 0,
      hasContactDetails:  contactWithDetails > 0,
      hasContactEmail:    contactWithEmail > 0,
      hasVerifiedEmail:   verifiedEmail > 0 || accountAgeMs > THEME_GRACE_MS,
      hasPhone:           !!(user?.phone?.trim()),
      hasVerifiedSender:  verifiedDomainCount > 0,
      hasInboundConnected: inboundConnectionCount > 0,
    },
    firstTxId: firstTx?.id ?? null,
  });
}
