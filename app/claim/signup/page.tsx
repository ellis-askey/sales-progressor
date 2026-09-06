import { prisma } from "@/lib/prisma";
import { ClaimSignupForm } from "@/components/claim/ClaimSignupForm";
import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { ClaimLogo } from "@/components/claim/ClaimLogo";
import { recordClaimStarted } from "@/lib/chain/funnel";
import "../styles/claim-flow.css";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="claim-page">
      <ClaimBackground />
      <header className="claim-header">
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
    where: { inviteToken: token },
    select: {
      id: true,
      transactionId: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
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
              claimedBy: { select: { firmName: true } },
              transaction: { select: { propertyAddress: true } },
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
  if (link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date())
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

  const MAX_PANEL_LINKS = 4;
  const shown = chainLinks.length <= MAX_PANEL_LINKS ? chainLinks : chainLinks.slice(0, MAX_PANEL_LINKS);
  const panelLinks = shown.map((cl) => ({
    id: cl.id,
    position: cl.position,
    transactionId: cl.transactionId,
    stubPropertyAddress: cl.stubPropertyAddress,
    claimedFirmName: cl.claimedBy?.firmName ?? null,
    transactionAddress: cl.transaction?.propertyAddress ?? null,
  }));
  const panelGhostCount = chainLinks.length > MAX_PANEL_LINKS ? chainLinks.length - MAX_PANEL_LINKS : 0;

  return (
    <Shell>
      <ClaimSignupForm
        token={token}
        stubEmail={link.stubAgentEmail ?? ""}
        stubAgencyName={link.stubAgencyName ?? ""}
        stubAddress={link.stubPropertyAddress ?? "Your sale"}
        ownLinkId={link.id}
        chainLinksCount={chainLinks.length}
        panelLinks={panelLinks}
        panelGhostCount={panelGhostCount}
        originatorName={originatorName}
        originatorAgency={originatorAgency}
        invitedDate={invitedDate}
      />
    </Shell>
  );
}
