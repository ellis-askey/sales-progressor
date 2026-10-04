// Server-side read/write for the email audience-bucket on/off switches
// (EmailBucketToggle). A bucket is ON unless a row explicitly turns it off;
// locked buckets (platform_admin) are always ON. The send pipeline calls
// isAudienceBucketEnabled() to decide whether to actually send.

import "server-only";

import { prisma } from "@/lib/prisma";
import { type AudienceBucket, LOCKED_BUCKETS, AUDIENCE_BUCKETS, fileBucket } from "./audience-buckets";

// Is this bucket currently allowed to send? Absence of a row = ON (safe default).
export async function isAudienceBucketEnabled(bucket: AudienceBucket): Promise<boolean> {
  if (LOCKED_BUCKETS.has(bucket)) return true;
  const row = await prisma.emailBucketToggle.findUnique({ where: { bucket }, select: { enabled: true } });
  return row ? row.enabled : true;
}

// Resolve the bucket for a FILE-DRIVEN email from its transaction. A lookup miss
// falls back to free_agency (the most permissive common case) so a missing tx
// never silently suppresses a real send.
export async function resolveFileBucketByTransaction(transactionId: string): Promise<AudienceBucket> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { progressionBusinessId: true, progressionBusiness: { select: { isTsp: true } } },
  });
  if (!tx) return "free_agency";
  return fileBucket({ progressionBusinessId: tx.progressionBusinessId, isTsp: tx.progressionBusiness?.isTsp ?? false });
}

// Current on/off for every bucket (locked buckets report ON). For the Command
// Centre toggle UI.
export async function getAllBucketStates(): Promise<Record<AudienceBucket, boolean>> {
  const rows = await prisma.emailBucketToggle.findMany({ select: { bucket: true, enabled: true } });
  const map = new Map(rows.map((r) => [r.bucket, r.enabled]));
  const out = {} as Record<AudienceBucket, boolean>;
  for (const b of AUDIENCE_BUCKETS) out[b] = LOCKED_BUCKETS.has(b) ? true : map.get(b) ?? true;
  return out;
}

// Flip a bucket on/off. Locked buckets are never stored off. Superadmin-gated by
// the caller (the command action).
export async function setBucketEnabled(bucket: AudienceBucket, enabled: boolean, userId: string | null): Promise<void> {
  if (LOCKED_BUCKETS.has(bucket)) return;
  await prisma.emailBucketToggle.upsert({
    where: { bucket },
    create: { bucket, enabled, updatedBy: userId },
    update: { enabled, updatedBy: userId },
  });
}
