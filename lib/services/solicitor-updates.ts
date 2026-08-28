import { prisma } from "@/lib/prisma";
import { milestoneScopeWhere, type MilestoneScope } from "@/lib/services/milestone-scope";
import { getMilestoneCopy, getMilestoneUpdateSubtextOther } from "@/lib/portal-copy";
import { solicitorOwnSubtext, solicitorOtherSubtextOverride } from "@/lib/solicitor-confirm/feed-copy";
import { getSignedUrl } from "@/lib/supabase-storage";

// A chronological "what's happened" feed for the solicitor portal. Own-side
// events carry full attribution (who + photo) and a date; the OTHER side's
// events are included for context but DATELESS and un-attributed (decision A2 +
// the user: "otherside too but dateless — still chronological so there's an idea
// of date/time without us displaying it"). Ordering conveys recency; the date is
// only rendered for own-side rows.
export type SolicitorFeedEntry = {
  id: string;
  at: number; // sort key (ms) — never rendered for other-side rows
  kind: "milestone" | "document";
  ownSide: boolean;
  title: string; // the fluent sentence
  sub: string | null; // attribution / secondary line
  actorName: string | null;
  actorImage: string | null;
  actorRole: "firm" | "agent" | "client" | null;
  eventDate: Date | null; // own-side milestone event date (rendered orange)
  shownDate: Date | null; // own-side only; null hides the timestamp
  docUrl: string | null;
};

export async function getSolicitorUpdates(
  txId: string,
  side: "vendor" | "purchaser",
  scope: MilestoneScope,
): Promise<SolicitorFeedEntry[]> {
  const comps = await prisma.milestoneCompletion.findMany({
    where: { transactionId: txId, state: "complete", ...milestoneScopeWhere(scope) },
    select: {
      id: true,
      completedAt: true,
      createdAt: true,
      eventDate: true,
      confirmedByContactId: true,
      confirmedBySolicitorFirm: { select: { name: true } },
      completedBy: { select: { name: true, image: true } },
      milestoneDefinition: { select: { code: true, side: true } },
    },
  });

  // The own-side handler's photo, shown on their firm-attributed confirmations.
  const txContacts = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: { vendorSolicitorContact: { select: { image: true } }, purchaserSolicitorContact: { select: { image: true } } },
  });
  const myFirmImage = (side === "vendor" ? txContacts?.vendorSolicitorContact?.image : txContacts?.purchaserSolicitorContact?.image) ?? null;

  const contactIds = comps.map((c) => c.confirmedByContactId).filter((x): x is string => !!x);
  const contacts = contactIds.length
    ? await prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, name: true, image: true } })
    : [];
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const milestoneEntries: SolicitorFeedEntry[] = comps.map((c) => {
    const code = c.milestoneDefinition.code;
    const ownSide = c.milestoneDefinition.side === side;
    const copy = getMilestoneCopy(code);
    const when = c.completedAt ?? c.createdAt;

    // Fluent sentence, voiced for a solicitor reader (not the client copy).
    const title = ownSide
      ? solicitorOwnSubtext(code) ?? copy.label
      : solicitorOtherSubtextOverride(code) ?? getMilestoneUpdateSubtextOther(code) ?? copy.labelOther ?? copy.label;

    let sub: string | null = null;
    let actorName: string | null = null;
    let actorImage: string | null = null;
    let actorRole: SolicitorFeedEntry["actorRole"] = null;

    if (ownSide) {
      if (c.confirmedBySolicitorFirm) {
        actorName = c.confirmedBySolicitorFirm.name;
        actorImage = myFirmImage;
        actorRole = "firm";
      } else if (c.confirmedByContactId) {
        const ct = contactById.get(c.confirmedByContactId);
        actorName = ct?.name ?? "The client";
        actorImage = ct?.image ?? null;
        actorRole = "client";
      } else if (c.completedBy) {
        actorName = c.completedBy.name;
        actorImage = c.completedBy.image;
        actorRole = "agent";
      }
      sub = actorName ? `Confirmed by ${actorName}` : "Confirmed";
    }

    return {
      id: c.id,
      at: (when ?? new Date(0)).getTime(),
      kind: "milestone",
      ownSide,
      title,
      sub,
      actorName,
      actorImage,
      actorRole,
      eventDate: ownSide ? c.eventDate : null,
      shownDate: ownSide ? when : null,
      docUrl: null,
    };
  });

  // Documents shared with this matter (MOS + anything shared cross-side).
  const docs = await prisma.transactionDocument.findMany({
    where: { transactionId: txId, OR: [{ source: "mos" }, { sharedWithOtherSide: true }] },
    select: { id: true, filename: true, storagePath: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const docEntries: SolicitorFeedEntry[] = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      at: d.createdAt.getTime(),
      kind: "document" as const,
      ownSide: true,
      title: d.filename,
      sub: "Shared document",
      actorName: null,
      actorImage: null,
      actorRole: null,
      eventDate: null,
      shownDate: d.createdAt,
      docUrl: await getSignedUrl(d.storagePath).catch(() => null),
    })),
  );

  return [...milestoneEntries, ...docEntries].sort((a, b) => b.at - a.at);
}
