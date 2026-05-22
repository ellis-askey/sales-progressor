// B5 of the client-chase arc (Sub-arc B).
//
// Server-rendered respond page — the deep-link destination from the chase
// digest email. Lists currently-due milestones for this contact with three
// per-row controls: confirm / set-date / leave-note.
//
// CRITICAL INVARIANT (B5 walk item #2): the page reads ClientChaseState
// authoritatively. The `?items=` query-param from the digest URL is
// IGNORED for what to show — a stale or forwarded chase link must reflect
// the CURRENT due state, never a frozen snapshot from when the email was
// sent. If the agent already confirmed all due items before the client
// clicked through, the page shows "all caught up." If new items have
// become due since the email, they appear too.
//
// Engagement tracking: every page-load updates lastEngagedAt for the
// contact's active ClientChaseState rows. Per the locked spec, a portal
// visit counts as engagement and resets the 14-day silence window even
// without an explicit action.
//
// COPY STATUS: DRAFT pending the pre-B7 copy batch. Strings here are
// placeholder.

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getMilestoneCopy } from "@/lib/portal-copy";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import { RespondList } from "@/components/portal/RespondList";

export const dynamic = "force-dynamic"; // never cache — always read current state

export default async function PortalRespondPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 1. Resolve the contact via the token. notFound() if invalid — matches
  //    the portal layout's pattern.
  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      propertyTransactionId: true,
      roleType: true,
      unsubscribedAt: true,
    },
  });
  if (!contact) notFound();

  // 2. Read ALL active ClientChaseState rows for (transaction, contact).
  //    This is the SOURCE OF TRUTH for what to show. The URL's items
  //    param is purely informational — we ignore it for display.
  const states = await prisma.clientChaseState.findMany({
    where: {
      transactionId: contact.propertyTransactionId,
      contactId: contact.id,
      status: "active",
    },
    orderBy: { firstChasedAt: "asc" },
    select: {
      id: true,
      milestoneCode: true,
      chaseCount: true,
      firstChasedAt: true,
    },
  });

  // 3. Filter to milestones that are STILL in state "available". A milestone
  //    confirmed (by anyone, anywhere) between chase send and this page load
  //    should NOT appear, even if the ClientChaseState row hasn't yet been
  //    updated to "completed" (race window: cron writes ClientChaseState
  //    asynchronously from milestone confirms).
  //
  //    Also filter on isClientChaseable so the six bilateral codes never
  //    appear here even if a stale ClientChaseState row somehow named one.
  const codes = states.map((s) => s.milestoneCode).filter((c) => isClientChaseable(c));
  const defs = codes.length > 0
    ? await prisma.milestoneDefinition.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const completions = defs.length > 0
    ? await prisma.milestoneCompletion.findMany({
        where: {
          transactionId: contact.propertyTransactionId,
          milestoneDefinitionId: { in: defs.map((d) => d.id) },
        },
        select: { milestoneDefinitionId: true, state: true, expectedDate: true },
      })
    : [];

  const defByCode = new Map(defs.map((d) => [d.code, d]));
  const compByDefId = new Map(completions.map((c) => [c.milestoneDefinitionId, c]));

  const due = states
    .map((s) => {
      if (!isClientChaseable(s.milestoneCode)) return null;
      const def = defByCode.get(s.milestoneCode);
      if (!def) return null;
      const comp = compByDefId.get(def.id);
      if (!comp || comp.state !== "available") return null; // confirmed since the email — drop
      const copy = getMilestoneCopy(s.milestoneCode);
      return {
        milestoneCode: s.milestoneCode,
        milestoneDefinitionId: def.id,
        label: copy.label,
        description: copy.description ?? "",
        expectedDate: comp.expectedDate ? comp.expectedDate.toISOString() : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // 4. Engagement tracking. Every page-load resets the silence clock for
  //    EVERY active row for this contact (not just the ones still due).
  //    The visit alone counts as engagement per the locked spec — even
  //    if the page shows "all caught up" because everything was confirmed
  //    elsewhere, the visit is recorded.
  if (states.length > 0) {
    await prisma.clientChaseState.updateMany({
      where: {
        transactionId: contact.propertyTransactionId,
        contactId: contact.id,
        status: "active",
      },
      data: { lastEngagedAt: new Date() },
    });
  }

  // 5. Transaction for address display.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { propertyAddress: true },
  });

  return (
    <RespondList
      token={token}
      contactName={contact.name}
      contactSide={contact.roleType === "vendor" ? "vendor" : "purchaser"}
      propertyAddress={tx?.propertyAddress ?? ""}
      isOptedOut={contact.unsubscribedAt != null}
      items={due}
    />
  );
}
