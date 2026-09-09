import { prisma } from "@/lib/prisma";
import { ClaimSignupForm } from "@/components/claim/ClaimSignupForm";
import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { ClaimLogo } from "@/components/claim/ClaimLogo";
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
          <h1 className="claim-error-h1">{title}</h1>
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
    return <ClaimError title="Invalid invite link" body="This link doesn't look right. Try copying it again, or ask the inviting agent for a new one." />;

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
          createdBy: { select: { name: true, firmName: true } },
          agency: { select: { name: true } },
          links: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              transactionId: true,
              stubPropertyAddress: true,
              stubAgencyName: true,
              stubPhotoStoragePath: true,
              claimedBy: { select: { firmName: true } },
              transaction: { select: { propertyAddress: true, photoStoragePath: true } },
            },
          },
        },
      },
    },
  });

  if (!link)
    return (
      <ClaimError
        title="Invite not found"
        body="This invite has expired or been replaced. Ask the inviting agent for a new one."
      />
    );
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED")
    return (
      <ClaimError
        title="Already claimed"
        body="This invite has already been used. If you think that's wrong, contact support."
      />
    );
  if (link.shareToken !== token && link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date())
    return (
      <ClaimError
        title="This invite has expired."
        body="This invite link has expired. Ask the inviting agent to resend it."
      />
    );

  // Funnel: they clicked "Claim this sale" and reached a claim step.
  await recordClaimStarted(link.id);

  const chainLinks = link.chain?.links ?? [];
  const originatorName = link.chain?.createdBy?.name ?? "An agent";
  const originatorAgency =
    link.chain?.createdBy?.firmName ?? link.chain?.agency?.name ?? null;
  const invitedDate = link.inviteSentAt
    ? new Date(link.inviteSentAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  // Build the same white chain ladder the /claim landing shows (photos + numbered
  // badges), so the signup panel matches it. Pills + contacts are off on signup.
  const MAX_VISIBLE = 4;
  const visibleLinks = chainLinks.length <= MAX_VISIBLE ? chainLinks : chainLinks.slice(0, MAX_VISIBLE);
  const ghostCount = chainLinks.length > MAX_VISIBLE ? chainLinks.length - MAX_VISIBLE : 0;
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
        originatorName={originatorName}
        originatorAgency={originatorAgency}
        invitedDate={invitedDate}
      />
    </Shell>
  );
}
