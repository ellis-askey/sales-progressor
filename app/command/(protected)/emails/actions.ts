"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { findSpecimen } from "@/lib/command/email-catalogue/registry";
import { resolveCatalogueIdentity, describeSignature, type Scenario, type IdentityTier } from "@/lib/command/email-catalogue/scenario";

export type RenderResult =
  | {
      ok: true;
      subject: string;
      html: string;
      fromTiers: IdentityTier[];
      replyToTiers: IdentityTier[];
      signature: string;
      themeLabel: string;
    }
  | { ok: false; error: string };

// Render one specimen under one scenario. Superadmin-gated (defence in depth —
// the /command layout already gates the page). Renders fixtures only; no data.
export async function renderSpecimenAction(id: string, scenario: Scenario): Promise<RenderResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return { ok: false, error: "Not authorised." };
  }
  const spec = findSpecimen(id);
  if (!spec) return { ok: false, error: "Unknown email." };
  try {
    const r = spec.render(scenario);
    const identity = resolveCatalogueIdentity(spec.senderKind, scenario.fileType);
    const signature = describeSignature(spec.signatureBehaviour, scenario.fileType);
    const themeLabel = spec.axes.includes("theme")
      ? scenario.theme === "custom"
        ? "Custom (navy / teal sample)"
        : "Coral (default)"
      : "Not themed";
    return {
      ok: true,
      subject: r.subject,
      html: r.html,
      fromTiers: identity.fromTiers,
      replyToTiers: identity.replyToTiers,
      signature,
      themeLabel,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Render failed." };
  }
}
