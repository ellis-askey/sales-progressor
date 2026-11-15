// Shared view types for native messaging (Phase 1). Pure types only — no prisma,
// no server-only imports — so both the server read layer and the client tab
// component can import them without pulling server code into the bundle.

import type { MessagingSide } from "./side";

export type StaffMessageView = {
  id: string;
  clientMsgId: string;
  body: string;
  senderKind: "staff" | "client";
  senderName: string | null;
  // True when the viewing staff user sent this message.
  mine: boolean;
  createdAt: string; // ISO
};

export type StaffSideData = {
  side: MessagingSide;
  label: string; // "Buyer" / "Seller"
  participantNames: string[]; // active-round principals with portal access on this side
  conversationId: string | null; // null until the first message creates the thread
  messages: StaffMessageView[];
  unread: number;
};

export type StaffFileMessaging = { sides: StaffSideData[] };
