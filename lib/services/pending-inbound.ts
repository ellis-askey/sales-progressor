// Phase E2b — read the current agent's "Needs filing" tray: inbound emails the
// sync couldn't confidently file, from THEIR connected mailbox. Server-only.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type PendingCandidate = { transactionId: string; address: string };
export type PendingInboundRow = {
  id: string;
  // "inbound" (received — show From:) | "outbound" (sent — show To:). Phase 2.
  direction: "inbound" | "outbound";
  subject: string;
  // The other party: for inbound it's the sender; for outbound it's the recipient.
  partyEmail: string;
  partyName: string | null;
  receivedAt: Date;
  preview: string;
  candidates: PendingCandidate[];
};

export async function getPendingInboundEmails(): Promise<PendingInboundRow[]> {
  const session = await requireSession();
  const rows = await prisma.pendingInboundEmail.findMany({
    where: { userId: session.user.id, status: "open" },
    orderBy: { receivedAt: "desc" },
    take: 30,
    select: {
      id: true, direction: true, subject: true, fromEmail: true, fromName: true,
      toEmail: true, toName: true, receivedAt: true, body: true, candidates: true,
    },
  });
  return rows.map((r) => {
    const outbound = r.direction === "outbound";
    return {
      id: r.id,
      direction: outbound ? ("outbound" as const) : ("inbound" as const),
      subject: r.subject,
      partyEmail: outbound ? (r.toEmail ?? "") : r.fromEmail,
      partyName: outbound ? r.toName : r.fromName,
      receivedAt: r.receivedAt,
      preview: (r.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      candidates: Array.isArray(r.candidates) ? (r.candidates as unknown as PendingCandidate[]) : [],
    };
  });
}
