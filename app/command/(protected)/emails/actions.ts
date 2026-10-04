"use server";

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { findSpecimen } from "@/lib/command/email-catalogue/registry";
import { specimenContentHash } from "@/lib/command/email-catalogue/review";
import { setBucketEnabled } from "@/lib/email/bucket-toggles";
import { resolveCatalogueIdentity, describeSignature, audienceBucketFor, AUDIENCE_LABEL, LOCKED_BUCKETS, type Scenario, type IdentityTier, type AudienceBucket } from "@/lib/command/email-catalogue/scenario";

export type RenderResult =
  | {
      ok: true;
      subject: string;
      html: string;
      fromTiers: IdentityTier[];
      replyToTiers: IdentityTier[];
      signature: string;
      themeLabel: string;
      bucket: AudienceBucket;
      bucketLabel: string;
      bucketLocked: boolean;
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
    const bucket = audienceBucketFor(spec.bucket, scenario.fileType);
    return {
      ok: true,
      subject: r.subject,
      html: r.html,
      fromTiers: identity.fromTiers,
      replyToTiers: identity.replyToTiers,
      signature,
      themeLabel,
      bucket,
      bucketLabel: AUDIENCE_LABEL[bucket],
      bucketLocked: LOCKED_BUCKETS.has(bucket),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Render failed." };
  }
}

// Tick / untick an email as reviewed + OK'd. Stored in the database (shared +
// auditable), not the browser. Ticking captures the email's current content hash
// so a later copy change re-flags it for review. Superadmin-only.
export async function setSpecimenReviewed(id: string, reviewed: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return { ok: false, error: "Not authorised." };
  }
  if (!findSpecimen(id)) return { ok: false, error: "Unknown email." };

  if (!reviewed) {
    await prisma.emailCatalogueReview.deleteMany({ where: { specimenId: id } });
    return { ok: true };
  }

  const contentHash = specimenContentHash(id);
  const by = session.user.id ?? null;
  const byEmail = session.user.email ?? null;
  await prisma.emailCatalogueReview.upsert({
    where: { specimenId: id },
    create: { specimenId: id, reviewedBy: by, reviewedByEmail: byEmail, contentHash },
    update: { reviewedBy: by, reviewedByEmail: byEmail, contentHash, reviewedAt: new Date() },
  });
  return { ok: true };
}

// Flip a whole audience bucket on or off platform-wide. When off, every email in
// that bucket stops sending (locked buckets can't be switched off). Superadmin-only.
export async function setBucketEnabledAction(bucket: AudienceBucket, enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return { ok: false, error: "Not authorised." };
  }
  await setBucketEnabled(bucket, enabled, session.user.id ?? null);
  return { ok: true };
}
