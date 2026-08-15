import "server-only";
import { prisma } from "@/lib/prisma";
import { isGlassVariantId, DEFAULT_VARIANT, type GlassVariantId } from "./variants";

// The portal Design Lab (founder-only) stores its picks GLOBALLY so they apply
// to every client's live portal — the founder styles a real file, then exports
// the JSON for hard implementation and we remove the lab. There's no per-client
// user to hang prefs on, so the single global source is the founder's own
// User.agentPreferences.portalGlassPicks. Read here on every portal render.
const PORTAL_LAB_EMAIL = "ellis@thesalesprogressor.co.uk";

export async function getPortalGlassPicks(): Promise<Record<string, GlassVariantId>> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: PORTAL_LAB_EMAIL },
      select: { agentPreferences: true },
    });
    const prefs =
      user?.agentPreferences && typeof user.agentPreferences === "object"
        ? (user.agentPreferences as Record<string, unknown>)
        : {};
    const raw = prefs.portalGlassPicks;
    const out: Record<string, GlassVariantId> = {};
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof k === "string" && k && isGlassVariantId(v) && v !== DEFAULT_VARIANT) {
          out[k] = v;
        }
      }
    }
    return out;
  } catch {
    // Never let a lab read break the portal for a real client.
    return {};
  }
}
