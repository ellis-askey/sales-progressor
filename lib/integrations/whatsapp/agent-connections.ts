// Agent-facing WhatsApp connection lifecycle (Phase 3), scoped to one user.
// Every function takes the caller's userId and only ever touches that user's own
// connection row, so an agent can never see or change someone else's (Law 7).
// The connect UI calls these via /api/agent/whatsapp/*.

import { prisma } from "@/lib/prisma";
import {
  isBridgeConfigured,
  bridgeStartPairing,
  bridgeConnectionStatus,
  bridgeConnectionQr,
  bridgeDisconnect,
} from "./bridge-client";

export type MyWhatsAppConnection = {
  id: string;
  status: string; // pending_qr | connected | disconnected
  phoneNumber: string | null;
  lastMessageAt: string | null;
  hasQr: boolean;
  qr: string | null;
  reachable: boolean;
};

export type MyWhatsAppStatus = {
  configured: boolean;
  connection: MyWhatsAppConnection | null;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

// The caller's live (non-disconnected) connection row, if any.
function findActiveRow(userId: string) {
  return prisma.whatsAppConnection.findFirst({
    where: { userId, status: { not: "disconnected" } },
    orderBy: { createdAt: "desc" },
  });
}

// Read the caller's own connection, refreshing live state from the bridge and
// reconciling the stored row when a connection exists.
export async function getMyWhatsAppStatus(userId: string): Promise<MyWhatsAppStatus> {
  const configured = isBridgeConfigured();
  const row = await findActiveRow(userId);
  if (!row) return { configured, connection: null };

  if (!configured) {
    return {
      configured,
      connection: {
        id: row.id,
        status: row.status,
        phoneNumber: row.phoneNumber,
        lastMessageAt: iso(row.lastMessageAt),
        hasQr: false,
        qr: null,
        reachable: false,
      },
    };
  }

  const [status, qr] = await Promise.all([bridgeConnectionStatus(row.id), bridgeConnectionQr(row.id)]);

  // The stored row is a cache of the bridge's live view. When the bridge is
  // reachable, reconcile: "open" means linked; capture the phone number once known.
  let effectiveStatus = row.status;
  if (status.reachable) {
    effectiveStatus = status.connection === "open" ? "connected" : "pending_qr";
    const patch: { status?: string; phoneNumber?: string; lastSeenAt: Date } = { lastSeenAt: new Date() };
    if (effectiveStatus !== row.status) patch.status = effectiveStatus;
    if (status.phoneNumber && status.phoneNumber !== row.phoneNumber) patch.phoneNumber = status.phoneNumber;
    await prisma.whatsAppConnection.update({ where: { id: row.id }, data: patch });
  }

  const phoneNumber = status.reachable ? status.phoneNumber ?? row.phoneNumber : row.phoneNumber;

  return {
    configured,
    connection: {
      id: row.id,
      status: effectiveStatus,
      phoneNumber,
      lastMessageAt: iso(row.lastMessageAt),
      hasQr: !!qr.qr,
      qr: qr.qr,
      reachable: status.reachable,
    },
  };
}

// Start (or restart) pairing for the caller: ensure a connection row exists,
// record consent, and ask the bridge to bring up a socket + QR.
export async function startMyWhatsAppPairing(
  userId: string,
): Promise<{ ok: boolean; connectionId?: string; error?: string }> {
  if (!isBridgeConfigured()) return { ok: false, error: "not_configured" };

  const existing = await findActiveRow(userId);
  const row = existing
    ? await prisma.whatsAppConnection.update({
        where: { id: existing.id },
        data: { status: "pending_qr", consentAcceptedAt: new Date() },
      })
    : await prisma.whatsAppConnection.create({
        data: { userId, status: "pending_qr", consentAcceptedAt: new Date() },
      });

  const res = await bridgeStartPairing(row.id);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, connectionId: row.id };
}

// Disconnect the caller's connection: tell the bridge to drop it, mark the row.
export async function disconnectMyWhatsApp(userId: string): Promise<{ ok: boolean }> {
  const row = await findActiveRow(userId);
  if (!row) return { ok: true };
  await bridgeDisconnect(row.id);
  await prisma.whatsAppConnection.update({ where: { id: row.id }, data: { status: "disconnected" } });
  return { ok: true };
}
