// Phase E2b — read the current agent's "Needs filing" tray: inbound emails the
// sync couldn't confidently file, from THEIR connected mailbox. Server-only.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type PendingCandidate = { transactionId: string; address: string };
export type PendingInboundRow = {
  id: string;
  subject: string;
  fromEmail: string;
  fromName: string | null;
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
      id: true, subject: true, fromEmail: true, fromName: true, receivedAt: true,
      body: true, candidates: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    fromEmail: r.fromEmail,
    fromName: r.fromName,
    receivedAt: r.receivedAt,
    preview: (r.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
    candidates: Array.isArray(r.candidates) ? (r.candidates as unknown as PendingCandidate[]) : [],
  }));
}
