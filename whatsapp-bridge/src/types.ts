// The payload the PWA ingest endpoint expects. Must stay in sync with
// BridgeMessage in ../../lib/integrations/whatsapp/ingest.ts.

export type BridgeMedia = {
  type: string; // image | video | document | audio | sticker
  mimetype?: string;
  caption?: string;
  filename?: string;
};

export type BridgeMessage = {
  waMessageId: string;
  waChatId: string;
  // Which agent connection forwarded this. Absent/null = the internal number
  // (unscoped). A value scopes the message to that connection's agency in the PWA.
  connectionId?: string | null;
  isGroup: boolean;
  groupName?: string | null;
  fromMe: boolean;
  senderPhone?: string | null;
  senderName?: string | null;
  body?: string | null;
  timestamp: number; // unix ms
  media?: BridgeMedia | null;
};

// Live status of one connection's socket. Shared by the manager, connections,
// and the HTTP surface (kept here to avoid a server<->connection import cycle).
export type BridgeState = {
  connection: "connecting" | "qr" | "open" | "close";
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastMessageAt: string | null;
};
