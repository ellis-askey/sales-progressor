import "server-only";
// Command Centre read model for the official Cloud API integration (Phase 1).
// Superadmin-only surface (Law 8); the underlying integration lib is shared.

import { prisma } from "@/lib/prisma";
import { isCloudConfigured, cloudEnv } from "@/lib/integrations/whatsapp-cloud/config";
import { ensureTspNumber } from "@/lib/integrations/whatsapp-cloud/accounts";

export type CloudPhase1Status = {
  configured: boolean;
  phoneNumberId: string | null;
  displayPhone: string | null;
  wabaId: string | null;
  lastEventAt: string | null;
  tokenExpiresAt: string | null;
  // 24h intake counts — proof the webhook genuinely flows.
  messages24h: number;
  statuses24h: number;
  unprocessed: number; // rows awaiting the Phase 2 thread router
};

export async function getCloudPhase1Status(): Promise<CloudPhase1Status> {
  if (!isCloudConfigured()) {
    return {
      configured: false,
      phoneNumberId: null,
      displayPhone: null,
      wabaId: null,
      lastEventAt: null,
      tokenExpiresAt: null,
      messages24h: 0,
      statuses24h: 0,
      unprocessed: 0,
    };
  }
  const row = await ensureTspNumber();
  const env = cloudEnv();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [messages24h, statuses24h, unprocessed] = await Promise.all([
    prisma.whatsAppCloudEvent.count({ where: { kind: "message", receivedAt: { gte: since } } }),
    prisma.whatsAppCloudEvent.count({ where: { kind: "status", receivedAt: { gte: since } } }),
    prisma.whatsAppCloudEvent.count({ where: { kind: "message", processedAt: null } }),
  ]);
  return {
    configured: true,
    phoneNumberId: row?.phoneNumberId ?? env?.phoneNumberId ?? null,
    displayPhone: row?.displayPhone ?? null,
    wabaId: row?.wabaId ?? env?.wabaId ?? null,
    lastEventAt: row?.lastEventAt?.toISOString() ?? null,
    tokenExpiresAt: row?.tokenExpiresAt?.toISOString() ?? null,
    messages24h,
    statuses24h,
    unprocessed,
  };
}
