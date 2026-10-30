// Phase E2b — read the current agent's "Needs filing" tray: inbound emails the
// sync couldn't confidently file, from THEIR connected mailbox. Server-only.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type PendingCandidate = {
  transactionId: string;
  address: string;
  // Live file state + a short price label, so two files at the SAME address can be
  // told apart on the tray buttons (critique #296). Absent if the file has since
  // been removed.
  status?: string;
  priceLabel?: string | null;
};

// Purchase price is stored in pence. Render it short for a button: 39500000 → "£395k".
function priceLabel(pence: number | null): string | null {
  if (pence == null) return null;
  const pounds = Math.round(pence / 100);
  if (pounds >= 1000) return `£${Math.round(pounds / 1000)}k`;
  return `£${pounds}`;
}
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

  // Enrich each candidate with its file's CURRENT state + price so the tray can
  // distinguish two files at the same address (critique #296). The candidate ids
  // are server-generated matches already surfaced to this user, so a by-id lookup
  // here leaks nothing new across tenants.
  const rawCandidates = rows.flatMap((r) =>
    Array.isArray(r.candidates) ? (r.candidates as unknown as PendingCandidate[]) : [],
  );
  const candidateIds = Array.from(new Set(rawCandidates.map((c) => c.transactionId)));
  const txMeta = candidateIds.length
    ? await prisma.propertyTransaction.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, status: true, purchasePrice: true },
      })
    : [];
  const metaById = new Map(txMeta.map((t) => [t.id, t]));

  return rows.map((r) => {
    const outbound = r.direction === "outbound";
    const candidates: PendingCandidate[] = (
      Array.isArray(r.candidates) ? (r.candidates as unknown as PendingCandidate[]) : []
    ).map((c) => {
      const meta = metaById.get(c.transactionId);
      return {
        transactionId: c.transactionId,
        address: c.address,
        status: meta?.status,
        priceLabel: priceLabel(meta?.purchasePrice ?? null),
      };
    });
    return {
      id: r.id,
      direction: outbound ? ("outbound" as const) : ("inbound" as const),
      subject: r.subject,
      partyEmail: outbound ? (r.toEmail ?? "") : r.fromEmail,
      partyName: outbound ? r.toName : r.fromName,
      receivedAt: r.receivedAt,
      preview: (r.body ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
      candidates,
    };
  });
}
