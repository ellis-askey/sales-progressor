// Phase 3 part 1 — agent-facing WhatsApp connection lifecycle.
// Mocks Prisma + the bridge client to assert scoping and reconciliation.
// See docs/active/whatsapp-agent-facing/SPEC.md §"Phase 3".

jest.mock("@/lib/prisma", () => ({
  prisma: {
    whatsAppConnection: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/lib/integrations/whatsapp/bridge-client", () => ({
  isBridgeConfigured: jest.fn(),
  bridgeStartPairing: jest.fn(),
  bridgeConnectionStatus: jest.fn(),
  bridgeConnectionQr: jest.fn(),
  bridgeDisconnect: jest.fn(),
}));

import { prisma } from "@/lib/prisma";
import * as bridge from "@/lib/integrations/whatsapp/bridge-client";
import {
  getMyWhatsAppStatus,
  startMyWhatsAppPairing,
  disconnectMyWhatsApp,
} from "@/lib/integrations/whatsapp/agent-connections";

const db = prisma as unknown as { whatsAppConnection: Record<string, jest.Mock> };
const b = bridge as unknown as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  b.isBridgeConfigured.mockReturnValue(true);
  db.whatsAppConnection.findFirst.mockResolvedValue(null);
  db.whatsAppConnection.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: "new1", phoneNumber: null, lastMessageAt: null, ...data }),
  );
  db.whatsAppConnection.update.mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
    Promise.resolve({ id: where.id, phoneNumber: null, lastMessageAt: null, status: "pending_qr", ...data }),
  );
  b.bridgeStartPairing.mockResolvedValue({ ok: true });
  b.bridgeConnectionStatus.mockResolvedValue({ configured: true, reachable: true, connection: "qr", phoneNumber: null, hasQr: true });
  b.bridgeConnectionQr.mockResolvedValue({ qr: "data:image/png;base64,xxx" });
  b.bridgeDisconnect.mockResolvedValue({ ok: true });
});

describe("getMyWhatsAppStatus", () => {
  it("returns no connection when the user has none, scoped to that user", async () => {
    const r = await getMyWhatsAppStatus("u1");
    expect(r.configured).toBe(true);
    expect(r.connection).toBeNull();
    expect(db.whatsAppConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: "u1" }) }),
    );
  });

  it("surfaces the QR while pairing", async () => {
    db.whatsAppConnection.findFirst.mockResolvedValue({ id: "c1", userId: "u1", status: "pending_qr", phoneNumber: null, lastMessageAt: null });
    const r = await getMyWhatsAppStatus("u1");
    expect(r.connection?.status).toBe("pending_qr");
    expect(r.connection?.hasQr).toBe(true);
    expect(r.connection?.qr).toContain("data:image");
  });

  it("marks connected and captures the phone number when the bridge reports open", async () => {
    db.whatsAppConnection.findFirst.mockResolvedValue({ id: "c1", userId: "u1", status: "pending_qr", phoneNumber: null, lastMessageAt: null });
    b.bridgeConnectionStatus.mockResolvedValue({ configured: true, reachable: true, connection: "open", phoneNumber: "+447700900123", hasQr: false });
    b.bridgeConnectionQr.mockResolvedValue({ qr: null });
    const r = await getMyWhatsAppStatus("u1");
    expect(r.connection?.status).toBe("connected");
    expect(r.connection?.phoneNumber).toBe("+447700900123");
    expect(db.whatsAppConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "connected", phoneNumber: "+447700900123" }) }),
    );
  });

  it("reflects the stored row without calling the bridge when unconfigured", async () => {
    b.isBridgeConfigured.mockReturnValue(false);
    db.whatsAppConnection.findFirst.mockResolvedValue({ id: "c1", userId: "u1", status: "pending_qr", phoneNumber: null, lastMessageAt: null });
    const r = await getMyWhatsAppStatus("u1");
    expect(r.configured).toBe(false);
    expect(r.connection?.reachable).toBe(false);
    expect(b.bridgeConnectionStatus).not.toHaveBeenCalled();
  });
});

describe("startMyWhatsAppPairing", () => {
  it("errors when the bridge isn't configured, creating nothing", async () => {
    b.isBridgeConfigured.mockReturnValue(false);
    const r = await startMyWhatsAppPairing("u1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("not_configured");
    expect(db.whatsAppConnection.create).not.toHaveBeenCalled();
  });

  it("creates a row, records consent, and starts pairing on the bridge", async () => {
    const r = await startMyWhatsAppPairing("u1");
    expect(r.ok).toBe(true);
    expect(r.connectionId).toBe("new1");
    const createArg = db.whatsAppConnection.create.mock.calls[0][0];
    expect(createArg.data.userId).toBe("u1");
    expect(createArg.data.status).toBe("pending_qr");
    expect(createArg.data.consentAcceptedAt).toBeInstanceOf(Date);
    expect(b.bridgeStartPairing).toHaveBeenCalledWith("new1");
  });

  it("reuses an existing active row instead of creating a second", async () => {
    db.whatsAppConnection.findFirst.mockResolvedValue({ id: "c1", userId: "u1", status: "pending_qr", phoneNumber: null });
    const r = await startMyWhatsAppPairing("u1");
    expect(r.connectionId).toBe("c1");
    expect(db.whatsAppConnection.create).not.toHaveBeenCalled();
    expect(db.whatsAppConnection.update).toHaveBeenCalled();
    expect(b.bridgeStartPairing).toHaveBeenCalledWith("c1");
  });
});

describe("disconnectMyWhatsApp", () => {
  it("drops the connection on the bridge and marks the row disconnected", async () => {
    db.whatsAppConnection.findFirst.mockResolvedValue({ id: "c1", userId: "u1", status: "connected", phoneNumber: "+447700900123" });
    const r = await disconnectMyWhatsApp("u1");
    expect(r.ok).toBe(true);
    expect(b.bridgeDisconnect).toHaveBeenCalledWith("c1");
    expect(db.whatsAppConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "disconnected" } }),
    );
  });

  it("is a no-op when there is no active connection", async () => {
    const r = await disconnectMyWhatsApp("u1");
    expect(r.ok).toBe(true);
    expect(b.bridgeDisconnect).not.toHaveBeenCalled();
  });
});
