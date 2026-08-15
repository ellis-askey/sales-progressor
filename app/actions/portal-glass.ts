"use server";

// Portal Design Lab write path (founder-only). Persists the GLOBAL portal glass
// picks so they apply to every client's live portal immediately. Gated to the
// hybrid-superadmin email (Ellis) — a bad write here is instantly client-facing,
// so nothing less trusted may call it. Writes to the founder's own
// User.agentPreferences.portalGlassPicks (the single global source read by
// lib/glass/portal-picks.ts).

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";
import { isGlassVariantId, DEFAULT_VARIANT } from "@/lib/glass/variants";

const PORTAL_LAB_EMAIL = "ellis@thesalesprogressor.co.uk";

export async function updatePortalGlassPicksAction(picks: Record<string, string>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isHybridSuperadminEmail(session.user.email)) {
    return { ok: false as const, error: "Forbidden" };
  }

  const cleaned: Record<string, string> = {};
  if (picks && typeof picks === "object") {
    for (const [k, v] of Object.entries(picks)) {
      if (typeof k === "string" && k && isGlassVariantId(v) && v !== DEFAULT_VARIANT) {
        cleaned[k] = v;
      }
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: PORTAL_LAB_EMAIL },
    select: { id: true, agentPreferences: true },
  });
  if (!user) return { ok: false as const, error: "Lab user not found" };

  const prefs =
    user.agentPreferences && typeof user.agentPreferences === "object"
      ? (user.agentPreferences as Record<string, unknown>)
      : {};

  await prisma.user.update({
    where: { id: user.id },
    data: { agentPreferences: { ...prefs, portalGlassPicks: cleaned } },
  });

  return { ok: true as const, count: Object.keys(cleaned).length };
}
