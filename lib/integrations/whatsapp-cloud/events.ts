import "server-only";
// Webhook payload → idempotent raw event rows (REBUILD_PLAN §C3: ack fast,
// process later). Phase 1 stores everything and stamps the health signal;
// the Phase 2 thread router consumes rows (processedAt) — until then the
// store is the verifiable record that receive + statuses genuinely flow.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { messageDedupKey, statusDedupKey } from "./signature";

type StoredCounts = { messages: number; statuses: number; other: number };

// The webhook body shape we care about. Everything else rides along in payload.
type WebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{ id?: string; from?: string; timestamp?: string; type?: string }>;
        statuses?: Array<{ id?: string; status?: string; recipient_id?: string; timestamp?: string }>;
      } & Record<string, unknown>;
    }>;
  }>;
};

export async function storeWebhookEvents(body: WebhookBody): Promise<StoredCounts> {
  const counts: StoredCounts = { messages: 0, statuses: 0, other: 0 };
  const rows: Prisma.WhatsAppCloudEventCreateManyInput[] = [];
  const touchedNumbers = new Set<string>();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      const phoneNumberId = value.metadata?.phone_number_id ?? "unknown";
      if (phoneNumberId !== "unknown") touchedNumbers.add(phoneNumberId);
      const payload = value as unknown as Prisma.InputJsonValue;

      if (change.field === "messages" && (value.messages?.length || value.statuses?.length)) {
        for (const m of value.messages ?? []) {
          if (!m.id) continue;
          rows.push({
            dedupKey: messageDedupKey(m.id),
            kind: "message",
            phoneNumberId,
            wamid: m.id,
            waFrom: m.from ?? null,
            payload,
          });
          counts.messages += 1;
        }
        for (const s of value.statuses ?? []) {
          if (!s.id || !s.status) continue;
          rows.push({
            dedupKey: statusDedupKey(s.id, s.status),
            kind: "status",
            phoneNumberId,
            wamid: s.id,
            status: s.status,
            payload,
          });
          counts.statuses += 1;
        }
      } else {
        // Template/account/quality events etc. — keep them; later phases read
        // these for template status sync and quality alerts.
        rows.push({
          dedupKey: `other:${change.field ?? "unknown"}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          kind: "other",
          phoneNumberId,
          payload,
        });
        counts.other += 1;
      }
    }
  }

  if (rows.length) {
    // skipDuplicates makes webhook redelivery a DB-level no-op (unique dedupKey).
    await prisma.whatsAppCloudEvent.createMany({ data: rows, skipDuplicates: true });
  }
  if (touchedNumbers.size) {
    await prisma.whatsAppBusinessNumber.updateMany({
      where: { phoneNumberId: { in: [...touchedNumbers] } },
      data: { lastEventAt: new Date() },
    });
  }
  return counts;
}

// Lifecycle of one message, assembled from its status events — Phase 1's
// verification read (the Command Centre test card polls this).
export async function getMessageLifecycle(wamid: string): Promise<{ status: string; at: Date }[]> {
  const rows = await prisma.whatsAppCloudEvent.findMany({
    where: { wamid, kind: "status" },
    orderBy: { receivedAt: "asc" },
    select: { status: true, receivedAt: true },
  });
  return rows.filter((r) => r.status).map((r) => ({ status: r.status as string, at: r.receivedAt }));
}
