// lib/chain/funnel.ts
//
// Chain-invite conversion-funnel instrumentation (Phase 0). Records where an
// invited agent gets to on their journey: viewed the chain landing page, then
// started a claim step. The DB stamps on ChainLink are the source of truth for
// the Command Centre funnel dashboard; the PostHog events mirror them for anyone
// working in PostHog. Both are best-effort — a tracking failure must never break
// the invited agent's page.

import { prisma } from "@/lib/prisma";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

// The invited agent isn't authenticated when they view/start, so we stitch their
// funnel events to one synthetic person per invite link.
const distinctIdFor = (linkId: string) => `chain-invite-${linkId}`;

// Stamp the first time the invited agent opened the /claim landing page. They can
// only reach it by clicking the email link, so this IS the email click-through.
// Idempotent: only the first view stamps and fires the event. (The claim-card
// A/B experiment was retired 2026-09-09 — white won — so no variant is tagged.)
export async function recordInviteViewed(linkId: string): Promise<void> {
  try {
    const res = await prisma.chainLink.updateMany({
      where: { id: linkId, inviteFirstViewedAt: null },
      data: { inviteFirstViewedAt: new Date() },
    });
    if (res.count > 0) {
      await trackServerEvent(distinctIdFor(linkId), ANALYTICS_EVENTS.CHAIN_INVITE_VIEWED, {
        linkId,
      });
    }
  } catch (err) {
    console.error(`[chain-funnel] recordInviteViewed failed for ${linkId}:`, err);
  }
}

// Stamp the first time someone opened a manually-shared claim link (the
// shareToken path — see ChainLink.shareToken). Mirrors recordInviteViewed but
// against its own column and tagged source:"share" so hand-shared links can be
// segmented apart from emailed invites. Idempotent; best-effort.
export async function recordShareLinkViewed(linkId: string): Promise<void> {
  try {
    const res = await prisma.chainLink.updateMany({
      where: { id: linkId, shareLinkFirstViewedAt: null },
      data: { shareLinkFirstViewedAt: new Date() },
    });
    if (res.count > 0) {
      await trackServerEvent(distinctIdFor(linkId), ANALYTICS_EVENTS.CHAIN_INVITE_VIEWED, {
        linkId,
        source: "share",
      });
    }
  } catch (err) {
    console.error(`[chain-funnel] recordShareLinkViewed failed for ${linkId}:`, err);
  }
}

// Stamp the first time the invited agent reached a claim step (signup / login /
// confirm) — i.e. they clicked "Claim this sale". The gap between this and a
// completed claim is the sign-up abandonment we most want to see.
export async function recordClaimStarted(linkId: string): Promise<void> {
  try {
    const res = await prisma.chainLink.updateMany({
      where: { id: linkId, claimStartedAt: null },
      data: { claimStartedAt: new Date() },
    });
    if (res.count > 0) {
      await trackServerEvent(distinctIdFor(linkId), ANALYTICS_EVENTS.CHAIN_CLAIM_STARTED, { linkId });
    }
  } catch (err) {
    console.error(`[chain-funnel] recordClaimStarted failed for ${linkId}:`, err);
  }
}
