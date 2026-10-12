import "server-only";
// Business-number registry access. Phase 1: TSP's own number, bootstrapped
// from env into a WhatsAppBusinessNumber row (token encrypted at rest) so the
// tenant-aware shape exists from day one — Phase 8 tenants land as more rows,
// not a different code path.

import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/security/token-crypto";
import { cloudEnv } from "./config";

// Idempotently sync the TSP-owned row from env. Called lazily from the send
// path and the Command Centre card — no boot hook needed. Returns the row, or
// null when the integration isn't configured.
export async function ensureTspNumber() {
  const env = cloudEnv();
  if (!env) return null;
  const existing = await prisma.whatsAppBusinessNumber.findUnique({
    where: { phoneNumberId: env.phoneNumberId },
  });
  // Re-encrypt only when the token actually changed (decrypt-compare), so the
  // row isn't churned on every call.
  if (existing) {
    let tokenChanged = true;
    try {
      tokenChanged = decryptSecret(existing.accessTokenEnc) !== env.accessToken;
    } catch {
      /* undecryptable (key rotated) → rewrite */
    }
    if (!tokenChanged && existing.wabaId === env.wabaId) return existing;
    return prisma.whatsAppBusinessNumber.update({
      where: { id: existing.id },
      data: { accessTokenEnc: encryptSecret(env.accessToken), wabaId: env.wabaId, status: "active", lastError: null },
    });
  }
  return prisma.whatsAppBusinessNumber.create({
    data: {
      ownerType: "tsp",
      wabaId: env.wabaId,
      phoneNumberId: env.phoneNumberId,
      accessTokenEnc: encryptSecret(env.accessToken),
    },
  });
}

// Token for a given business number: DB row first (works for future tenant
// numbers), env fallback for TSP's own before the row exists.
export async function resolveAccessToken(phoneNumberId: string): Promise<string | null> {
  const row = await prisma.whatsAppBusinessNumber.findUnique({ where: { phoneNumberId } });
  if (row) {
    try {
      return decryptSecret(row.accessTokenEnc);
    } catch {
      /* fall through to env */
    }
  }
  const env = cloudEnv();
  return env && env.phoneNumberId === phoneNumberId ? env.accessToken : null;
}
