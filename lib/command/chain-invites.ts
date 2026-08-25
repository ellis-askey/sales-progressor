import { commandDb } from "@/lib/command/prisma";

// Command Centre → Chain invites. The conversion funnel for agent-to-agent chain
// invites: how far each invited agency gets from "email sent" to "joined", and a
// call-list of the agents who looked but haven't joined. Source of truth is the
// funnel stamps on ChainLink (inviteSentAt / inviteFirstViewedAt / claimStartedAt
// / claimedAt / inviteDeclinedAt / inviteBouncedAt), written by lib/chain/funnel.ts
// and the claim flow. Read-only, superadmin scope via commandDb.

export type ChainFunnel = {
  sent: number; // invite email sent
  viewed: number; // opened the chain landing page (clicked through from the email)
  started: number; // reached a claim step (clicked "Claim this sale")
  joined: number; // finished — account + file linked to the chain
};

export type ChainInviteFollowUp = {
  linkId: string;
  address: string;
  invitedAgency: string | null;
  invitedName: string | null;
  invitedEmail: string | null;
  invitingAgent: string | null;
  invitingAgency: string | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  startedAt: Date | null;
};

export type ChainInviteReport = {
  funnel: ChainFunnel;
  declined: number; // said "not my sale"
  bounced: number; // email undeliverable
  expired: number; // link lapsed before they joined
  awaitingView: number; // sent, still no sign they opened it
  rangeDays: number | null; // null = all time
  followUps: ChainInviteFollowUp[]; // looked but haven't joined — the call list
};

// A neighbour that's been added to a chain with a usable email but never invited
// — free pipeline sitting idle. Ellis's list to prod personally, or to prompt the
// originating agency to send. See docs/active/chain-invite-conversion — Phase 4.
export type UninvitedNeighbour = {
  linkId: string;
  neighbourAddress: string;
  neighbourAgency: string | null;
  neighbourEmail: string | null;
  invitingAgent: string | null;
  invitingAgency: string | null;
  addedAt: Date;
};

export async function getUninvitedNeighbours(): Promise<UninvitedNeighbour[]> {
  const links = await commandDb.chainLink.findMany({
    where: {
      transactionId: null,
      inviteStatus: "NOT_SENT",
      stubAgentEmail: { contains: "@" },
    },
    select: {
      id: true,
      stubPropertyAddress: true,
      stubAgencyName: true,
      stubAgentEmail: true,
      createdAt: true,
      chain: { select: { createdBy: { select: { name: true, firmName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return links.map((l) => ({
    linkId: l.id,
    neighbourAddress: l.stubPropertyAddress ?? "A neighbouring sale",
    neighbourAgency: l.stubAgencyName,
    neighbourEmail: l.stubAgentEmail,
    invitingAgent: l.chain.createdBy?.name ?? null,
    invitingAgency: l.chain.createdBy?.firmName ?? null,
    addedAt: l.createdAt,
  }));
}

export async function getChainInviteReport(rangeDays: number | null): Promise<ChainInviteReport> {
  const since =
    rangeDays != null ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000) : null;

  const links = await commandDb.chainLink.findMany({
    where: { inviteSentAt: since ? { gte: since } : { not: null } },
    select: {
      id: true,
      inviteStatus: true,
      inviteSentAt: true,
      inviteFirstViewedAt: true,
      claimStartedAt: true,
      claimedAt: true,
      inviteDeclinedAt: true,
      inviteBouncedAt: true,
      inviteTokenExpiresAt: true,
      stubPropertyAddress: true,
      stubAgencyName: true,
      stubAgentName: true,
      stubAgentEmail: true,
      chain: { select: { createdBy: { select: { name: true, firmName: true } } } },
    },
    orderBy: { inviteSentAt: "desc" },
  });

  const now = new Date();
  const isJoined = (l: (typeof links)[number]) => l.inviteStatus === "CLAIMED" || l.claimedAt != null;

  const funnel: ChainFunnel = {
    sent: links.length,
    viewed: links.filter((l) => l.inviteFirstViewedAt != null).length,
    started: links.filter((l) => l.claimStartedAt != null).length,
    joined: links.filter(isJoined).length,
  };

  const declined = links.filter((l) => l.inviteDeclinedAt != null).length;
  const bounced = links.filter((l) => l.inviteBouncedAt != null).length;
  const expired = links.filter(
    (l) =>
      !isJoined(l) &&
      l.inviteDeclinedAt == null &&
      l.inviteBouncedAt == null &&
      l.inviteTokenExpiresAt != null &&
      l.inviteTokenExpiresAt < now,
  ).length;
  const awaitingView = links.filter(
    (l) =>
      l.inviteFirstViewedAt == null &&
      !isJoined(l) &&
      l.inviteDeclinedAt == null &&
      l.inviteBouncedAt == null &&
      !(l.inviteTokenExpiresAt != null && l.inviteTokenExpiresAt < now),
  ).length;

  // The call-list: they opened the invite but haven't joined or declined. These
  // are the warmest leads — a personal nudge from the founder converts them.
  const followUps: ChainInviteFollowUp[] = links
    .filter((l) => l.inviteFirstViewedAt != null && !isJoined(l) && l.inviteDeclinedAt == null)
    .map((l) => ({
      linkId: l.id,
      address: l.stubPropertyAddress ?? "A sale in the chain",
      invitedAgency: l.stubAgencyName,
      invitedName: l.stubAgentName,
      invitedEmail: l.stubAgentEmail,
      invitingAgent: l.chain.createdBy?.name ?? null,
      invitingAgency: l.chain.createdBy?.firmName ?? null,
      sentAt: l.inviteSentAt,
      viewedAt: l.inviteFirstViewedAt,
      startedAt: l.claimStartedAt,
    }));

  return { funnel, declined, bounced, expired, awaitingView, rangeDays, followUps };
}
