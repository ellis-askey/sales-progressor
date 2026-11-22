import { prisma } from "@/lib/prisma";
import { getSignedUrlMap } from "@/lib/supabase-storage";

// Resolve signed property-photo URLs for a set of transaction ids. One query +
// one batch-sign; returns txId → signed URL (null when the file has no photo, so
// PropertyThumb shows its house fallback). Shared by the automated-emails feed
// and the coverage file list so every property row can show its photo, matching
// the By-sale cockpit (which already signs its own).
export async function signPhotosByTx(txIds: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (txIds.length === 0) return out;
  const rows = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds } },
    select: { id: true, photoStoragePath: true },
  });
  const signed = await getSignedUrlMap(rows.map((r) => r.photoStoragePath).filter((p): p is string => !!p));
  for (const r of rows) out.set(r.id, r.photoStoragePath ? signed.get(r.photoStoragePath) ?? null : null);
  return out;
}
