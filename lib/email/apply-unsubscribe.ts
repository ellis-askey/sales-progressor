// lib/email/apply-unsubscribe.ts
//
// Applies the suppression a verified unsubscribe token asks for. Shared by the
// RFC 8058 one-click POST (the mail client's native Unsubscribe button) and the
// confirmation-page button. Deliberately NOT called from a plain GET: email
// security scanners / link prefetchers open every link in the background, and a
// GET that changed state would let them silently unsubscribe the recipient.
//
// Idempotent: the null guards make a repeat a no-op. Returns whether the subject
// was known and an optional `type` for the confirmation page copy.

import { prisma } from "@/lib/prisma";
import { haltActiveFlows } from "@/lib/prospects/flow-ops";

export async function applyUnsubscribe(subject: string): Promise<{ ok: boolean; type?: string }> {
  if (subject.startsWith("user:")) {
    await prisma.user.updateMany({
      where: { id: subject.slice(5), emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: new Date() },
    });
    return { ok: true };
  }

  if (subject.startsWith("invite:")) {
    await prisma.chainLink.updateMany({
      where: { id: subject.slice(7), inviteUnsubscribedAt: null },
      data: { inviteUnsubscribedAt: new Date() },
    });
    return { ok: true };
  }

  if (subject.startsWith("contact:")) {
    await prisma.contact.updateMany({
      where: { id: subject.slice(8), unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return { ok: true, type: "contact" };
  }

  if (subject.startsWith("prospect:")) {
    const prospectId = subject.slice("prospect:".length);
    await prisma.prospect.updateMany({
      where: { id: prospectId, optedOutAt: null },
      data: { optedOutAt: new Date() },
    });
    await haltActiveFlows(prospectId, "opted_out").catch(() => {});
    await prisma.prospectActivity
      .create({ data: { prospectId, type: "opted_out", summary: "Unsubscribed from outreach" } })
      .catch(() => {});
    return { ok: true };
  }

  return { ok: false };
}
