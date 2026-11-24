import { prisma } from "@/lib/prisma";
import { ClaimSignupForm } from "@/components/claim/ClaimSignupForm";
import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { ClaimLogo } from "@/components/claim/ClaimLogo";
import { PageTitle } from "@/components/ui/PageTitle";
import { recordClaimStarted } from "@/lib/chain/funnel";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { displayChainPosition } from "@/lib/chain/positions";
import type { LadderRow } from "@/components/claim/ClaimChainLadder";
import "../styles/claim-flow.css";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="claim-page">
      <ClaimBackground />
      <header className="claim-header claim-header--b">
        <ClaimLogo />
      </header>
      {children}
    </div>
  );
}

function ClaimError({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="claim-error-wrap">
        <div className="claim-error-inner">
          <p className="claim-error-eyebrow">The Sales Progressor</p>
          <PageTitle title={title} color="#20242E" subtitleColor="#3F3F46" />
          <p className="claim-error-p">{body}</p>
          <p className="claim-error-support">
            Need help?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </Shell>
  );
}

export default async function ClaimSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token)
    return <ClaimError title="Invalid invite link." body="This link doesn't look right. Try copying it again, or ask the inviting agent for a new one." />;

  const link = await prisma.chainLink.findFirst({
    // Emailed invite token OR manually-shared share token — same slot either way.
    where: { OR: [{ inviteToken: token }, { shareToken: token }] },
    select: {
      id: true,
      transactionId: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      shareToken: true,
      inviteSentAt: true,
      stubAgentEmail: true,
      stubAgencyName: true,
      stubPropertyAddress: true,
      chain: {
        select: {
          createdByUserId: true,
          createdBy: { select: { name: true, firmName: true } },
          agency: { select: { name: true } },
          links: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              transactionId: true,
              createdByUserId: true,
              claimedByUserId: true,
              withdrawalStatus: true,
              stubPropertyAddress: true,
              stubAgencyName: true,
              stubPhotoStoragePath: true,
              claimedBy: { select: { firmName: true } },
              transaction: {
                select: {
                  propertyAddress: true,
                  photoStoragePath: true,
                  status: true,
                  assignedUser: { select: { name: true, firmName: true, image: true, agencyId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!link)
    return (
      <ClaimError
        title="Invite not found."
        body="This invite has expired or been replaced. Ask the inviting agent for a new one."
      />
    );
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED")
    return (
      <ClaimError
        title="Already claimed."
        body="This invite has already been used. If you think that's wrong, contact support."
      />
    );
  if (link.shareToken !== token && link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date())
    return (
      <ClaimError
        title="This invite has expired."
        body="The link was valid for 7 days after it was sent. Ask the inviting agent to resend it."
      />
    );

  // Chain-broken guard — mirror the /claim landing (a sale may have withdrawn
  // after the landing loaded but before signup). Without this, the user fills
  // the whole form before the claim POST fails.
  const chainBroken = (link.chain?.links ?? []).some(
    (cl) => cl.transaction?.status === "withdrawn" || cl.withdrawalStatus === "WITHDRAWN",
  );
  if (chainBroken)
    return (
      <ClaimError
        title="This chain has changed."
        body="A sale in this chain has withdrawn. Ask the inviting agent for a fresh invite once the chain has been resolved."
      />
    );

  // Funnel: they clicked "Claim this sale" and reached a claim step.
  await recordClaimStarted(link.id);

  const chainLinks = link.chain?.links ?? [];
  // Inviter identity — resolved the same way as the /claim landing (E6) so the
  // name stays stable across the two steps. Outsourced files (an assignedUser
  // with agencyId null) attribute the invite to the internal progressor running
  // it; the agency label always stays the agency's (white-label).
  const originatorFile = chainLinks.find(
    (l) =>
      l.transaction &&
      (l.claimedByUserId === link.chain?.createdByUserId || l.createdByUserId === link.chain?.createdByUserId),
  );
  const manager = originatorFile?.transaction?.assignedUser ?? null;
  const isOutsourced = !!manager && manager.agencyId === null;
  const originatorName = isOutsourced
    ? (manager!.name ?? link.chain?.createdBy?.name ?? "An agent")
    : (link.chain?.createdBy?.name ?? "An agent");
  const originatorAgency =
    link.chain?.agency?.name ?? link.chain?.createdBy?.firmName ?? null;
  const invitedDate = link.inviteSentAt
    ? new Date(link.inviteSentAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // Build the same white chain ladder the /claim landing shows (photos + numbered
  // badges), so the signup panel matches it. Pills + contacts are off on signup.
  // The 4-row window must ALWAYS contain the invited slot — on a long chain the
  // old first-4 slice could drop the claimer's own sale into the ghost row,
  // which the fold-to-your-sale behaviour then surfaced as a missing row
  // (found 2026-10-13). Ghosts cover whichever side gets truncated.
  const MAX_VISIBLE = 4;
  const youIndex = Math.max(0, chainLinks.findIndex((cl) => cl.id === link.id));
  const windowStart =
    chainLinks.length <= MAX_VISIBLE
      ? 0
      : Math.min(Math.max(0, youIndex - (MAX_VISIBLE - 1)), chainLinks.length - MAX_VISIBLE);
  const visibleLinks = chainLinks.slice(windowStart, windowStart + MAX_VISIBLE);
  const ghostTopCount = windowStart;
  const ghostCount = Math.max(0, chainLinks.length - (windowStart + MAX_VISIBLE));
  const shaped = visibleLinks.map((cl) => {
    const isYours = cl.id === link.id;
    const isClaimed = cl.transactionId !== null;
    const photoPath = isClaimed ? (cl.transaction?.photoStoragePath ?? null) : (cl.stubPhotoStoragePath ?? null);
    return {
      id: cl.id,
      displayNum: displayChainPosition(cl.position, chainLinks.length),
      status: (isYours ? "you" : isClaimed ? "joined" : "pending") as LadderRow["status"],
      address: isClaimed
        ? (cl.transaction?.propertyAddress ?? "")
        : isYours
        ? (link.stubPropertyAddress ?? "")
        : (cl.stubPropertyAddress ?? ""),
      agency: cl.claimedBy?.firmName ?? cl.stubAgencyName ?? null,
      photoPath,
    };
  });
  const signed = await getSignedUrlMap(shaped.map((r) => r.photoPath));
  const ladder: LadderRow[] = shaped.map((r) => ({
    id: r.id,
    displayNum: r.displayNum,
    status: r.status,
    address: r.address,
    agency: r.agency,
    photoUrl: r.photoPath ? (signed.get(r.photoPath) ?? null) : null,
  }));

  return (
    <Shell>
      <ClaimSignupForm
        token={token}
        stubEmail={link.stubAgentEmail ?? ""}
        stubAgencyName={link.stubAgencyName ?? ""}
        stubAddress={link.stubPropertyAddress ?? "Your sale"}
        ladder={ladder}
        ghostCount={ghostCount}
        ghostTopCount={ghostTopCount}
        originatorName={originatorName}
        originatorAgency={originatorAgency}
        invitedDate={invitedDate}
      />
    </Shell>
  );
}
