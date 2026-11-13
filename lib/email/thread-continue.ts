// Email threading (Stage 2): find a prior sent email on a sale that the agent
// could continue, given who they're emailing now. Powers the quiet "continue
// your conversation" whisper in the composer.
//
// Matching rules (agreed with founder, 2026-11-13):
//   • Match on the TO recipients only — Cc/Bcc are ignored.
//   • "Same core group": one To-set contains the other (identical, or the same
//     group with a person added or removed). Not a loose any-overlap match.
//   • Only emails sent WITH threading on (they carry a stored Message-ID) can be
//     continued; older/un-stamped sends can't, so they never surface here.
//   • Gated by agency — returns null entirely when threading is off for the sale.

import { prisma } from "@/lib/prisma";
import { isEmailThreadingEnabled } from "@/lib/email/threading";

export type ContinuableThread = {
  // The previous message's RFC Message-ID → the new email's In-Reply-To.
  inReplyTo: string;
  // The full References chain for the new email (prior chain + prior Message-ID).
  references: string;
  // The prior subject — prefilled (editable) when the agent continues.
  subject: string;
  // When the prior email went out, for the "from 11 Nov" label.
  sentAt: string;
};

const norm = (e: string) => e.trim().toLowerCase();

// One To-set contains the other (ignoring order/case), with at least one shared
// address. True for identical sets and for "same group ± one person".
export function sameCoreGroup(a: string[], b: string[]): boolean {
  const A = new Set(a.map(norm).filter(Boolean));
  const B = new Set(b.map(norm).filter(Boolean));
  if (!A.size || !B.size) return false;
  const aInB = [...A].every((x) => B.has(x));
  const bInA = [...B].every((x) => A.has(x));
  return aInB || bInA;
}

export async function findContinuableThread(
  transactionId: string,
  toEmails: string[],
  agencyId: string | null,
): Promise<ContinuableThread | null> {
  if (!isEmailThreadingEnabled(agencyId)) return null;
  const to = [...new Set(toEmails.map(norm).filter(Boolean))];
  if (!to.length) return null;

  // Recent threaded sends on this file, newest first. The list is small and
  // bounded; the group match is done in JS for clarity.
  const rows = await prisma.outboundMessage.findMany({
    where: {
      transactionId,
      type: "outbound",
      method: "email",
      internetMessageId: { not: null },
      recipientEmails: { isEmpty: false },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { internetMessageId: true, emailReferences: true, subject: true, sentAt: true, createdAt: true, recipientEmails: true },
  });

  for (const r of rows) {
    if (!r.internetMessageId) continue;
    if (!sameCoreGroup(r.recipientEmails, to)) continue;
    return {
      inReplyTo: r.internetMessageId,
      references: r.emailReferences ? `${r.emailReferences} ${r.internetMessageId}` : r.internetMessageId,
      subject: r.subject ?? "",
      sentAt: (r.sentAt ?? r.createdAt).toISOString(),
    };
  }
  return null;
}
