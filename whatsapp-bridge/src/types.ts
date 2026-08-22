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
  isGroup: boolean;
  groupName?: string | null;
  fromMe: boolean;
  senderPhone?: string | null;
  senderName?: string | null;
  body?: string | null;
  timestamp: number; // unix ms
  media?: BridgeMedia | null;
};
