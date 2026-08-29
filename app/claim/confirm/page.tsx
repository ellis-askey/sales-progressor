import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findDuplicateTransactions } from "@/lib/chain/duplicate-detection";
import { ClaimConfirmForm } from "@/components/claim/ClaimConfirmForm";
import { getOnwardInheritanceForLink, getRelatedSaleInheritanceForLink } from "@/lib/services/onward";
import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { displayChainPosition } from "@/lib/chain/positions";
import { recordClaimStarted } from "@/lib/chain/funnel";
import "../styles/claim-flow.css";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="claim-page">
      <ClaimBackground />
      <header className="claim-header">
        <a
          href="https://www.thesalesprogressor.co.uk"
          target="_blank"
          rel="noopener"
          className="claim-wordmark"
        >
          The Sales Progressor
        </a>
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

export default async function ClaimConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token)
    return <ClaimError title="Invalid invite link" body="This link doesn't look right. Try copying it again, or ask the inviting agent for a new one." />;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/claim/login?token=${token}`);
  }

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      transactionId: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
      chain: {
        select: {
          createdByUserId: true,
          createdBy: { select: { name: true, firmName: true } },
          agency: { select: { name: true } },
          links: {
            select: { id: true, position: true },
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
        body="The link was valid for 7 days after it was sent. Ask the inviting agent to resend it."
      />
    );

  // Funnel: they clicked "Claim this sale" and reached the confirm step.
  await recordClaimStarted(link.id);

  // Self-claim guard
  if (link.chain.createdByUserId === session.user.id)
    return (
      <ClaimError
        title="Can't claim your own invite"
        body="You created this chain. You can't claim an invite you sent."
      />
    );

  // No email-match wall (Phase 2): the invite token is the bearer secret, so any
  // logged-in agent who holds a valid link and has an agency can claim it. The
  // self-claim guard above still stops the originator. This removes the silent
  // dead-ends from forwarded invites, generic office inboxes, and logging in with
  // a different address. See docs/active/chain-invite-conversion.

  // Duplicate detection
  const agencyId = session.user.agencyId;
  const stubAddress = link.stubPropertyAddress ?? "";
  const duplicateMatches =
    stubAddress && agencyId
      ? await findDuplicateTransactions(agencyId, stubAddress)
      : [];

  type EnrichedMatch = { transactionId: string; propertyAddress: string; createdAt: Date };
  let enrichedMatches: EnrichedMatch[] = [];
  if (duplicateMatches.length > 0) {
    const txns = await prisma.propertyTransaction.findMany({
      where: { id: { in: duplicateMatches.map((m) => m.transactionId) } },
      select: { id: true, propertyAddress: true, createdAt: true },
    });
    enrichedMatches = txns.map((t) => ({
      transactionId: t.id,
      propertyAddress: t.propertyAddress,
      createdAt: t.createdAt,
    }));
  }

  // Chain position
  const stubLink = link.chain.links.find((l) => l.id === link.id);
  const totalLinks = link.chain.links.length;
  const chainPosition =
    stubLink !== undefined ? displayChainPosition(stubLink.position, totalLinks) : null;

  // Originator
  const originatorName = link.chain.createdBy?.name ?? null;
  const originatorAgency =
    link.chain.createdBy?.firmName ?? link.chain.agency?.name ?? null;

  const hasDuplicates = enrichedMatches.length > 0;

  // Milestone definitions for the reconciliation picker. Static catalogue (47 rows),
  // safe to fetch once per page render. Filtering for tenure/purchaseType happens client-side.
  const milestoneDefinitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    select: { id: true, code: true, name: true, side: true, orderIndex: true, blocksExchange: true },
  });

  // Inheritance (Stage 3 + related-sale twin): both neighbours may have reported
  // progress on the property being claimed, from opposite sides.
  //   - the seller BELOW reported their onward purchase of it → purchaser-side steps
  //   - the buyer ABOVE reported their related sale of it → vendor-side steps
  // Offer the union as a pre-filled head-start for the reconciliation wizard.
  const [onwardInheritance, relatedInheritance] = await Promise.all([
    getOnwardInheritanceForLink(link.id).catch(() => null),
    getRelatedSaleInheritanceForLink(link.id).catch(() => null),
  ]);
  const inheritance = onwardInheritance || relatedInheritance
    ? {
        tenure: onwardInheritance?.tenure ?? relatedInheritance?.tenure ?? null,
        purchaseType: onwardInheritance?.purchaseType ?? null,
        isShareOfFreehold: onwardInheritance?.isShareOfFreehold ?? relatedInheritance?.isShareOfFreehold ?? false,
        stepDefIds: [
          ...milestoneDefinitions
            .filter((d) => d.side === "purchaser" && (onwardInheritance?.stepCodes.includes(d.code) ?? false))
            .map((d) => d.id),
          ...milestoneDefinitions
            .filter((d) => d.side === "vendor" && (relatedInheritance?.stepCodes.includes(d.code) ?? false))
            .map((d) => d.id),
        ],
      }
    : null;

  return (
    <Shell>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 20px 64px" }}>
        <div className="claim-context-strip">
          <a href={`/claim?token=${token}`} className="claim-context-back">
            ← Back
          </a>
          <div className="claim-context-info">
            <div className="claim-context-label">You&apos;re claiming</div>
            <div className="claim-context-address">
              {link.stubPropertyAddress ?? "Your sale"}
            </div>
          </div>
        </div>

        {/* Summary card — shown when no duplicates */}
        {!hasDuplicates && (
          <div className="claim-summary">
            {stubAddress && (
              <div className="claim-summary-row">
                <span className="claim-summary-label">Property</span>
                <span className="claim-summary-value">{stubAddress}</span>
              </div>
            )}
            {originatorName && (
              <div className="claim-summary-row">
                <span className="claim-summary-label">Invited by</span>
                <span className="claim-summary-value">
                  {originatorName}
                  {originatorAgency ? ` · ${originatorAgency}` : ""}
                </span>
              </div>
            )}
            <div className="claim-summary-row">
              <span className="claim-summary-label">Your account</span>
              <span className="claim-summary-value">{session.user.email}</span>
            </div>
            {chainPosition !== null && (
              <div className="claim-summary-row">
                <span className="claim-summary-label">Chain position</span>
                <span className="claim-summary-value">
                  #{chainPosition} of {totalLinks}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="claim-form-card">
          <h1 className="claim-confirm-h1">
            {hasDuplicates ? "Looks like you already have this sale." : "Ready to join this chain"}
          </h1>
          <p className="claim-confirm-p">
            {hasDuplicates
              ? "There's already a sale at this address in your files. Link it to this chain, or start a fresh file."
              : "Confirm the details below and we’ll link your sale to the chain."}
          </p>

          <ClaimConfirmForm
            token={token}
            stubAddress={stubAddress}
            duplicates={enrichedMatches.map((m) => ({
              transactionId: m.transactionId,
              propertyAddress: m.propertyAddress,
              createdAt: m.createdAt.toISOString(),
            }))}
            milestoneDefinitions={milestoneDefinitions}
            inheritance={inheritance}
          />

          <p className="claim-wrong-note">
            Wrong invite? <a href={`/claim?token=${token}`}>Go back</a>
          </p>
        </div>
      </div>
    </Shell>
  );
}
