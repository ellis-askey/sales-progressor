import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayChainPosition } from "@/lib/chain/positions";
import { recordInviteViewed } from "@/lib/chain/funnel";
import { getSignedUrlMap } from "@/lib/supabase-storage";
import { claimVariantFor, parseVariantOverride } from "@/lib/chain/claim-experiment";
import { ClaimBackground } from "@/components/claim/ClaimBackground";
import { ClaimLogo } from "@/components/claim/ClaimLogo";
import { ClaimCtaButton } from "@/components/claim/ClaimCtaButton";
import { ClaimInviteCard, type LadderRow } from "@/components/claim/ClaimInviteCard";
import "./styles/claim-flow.css";

function Shell({
  children,
  variant = "A",
  loginHref,
}: {
  children: React.ReactNode;
  variant?: "A" | "B";
  loginHref?: string | null;
}) {
  return (
    <div className="claim-page">
      <ClaimBackground />
      <header className={variant === "B" ? "claim-header claim-header--b" : "claim-header"}>
        <ClaimLogo />
        {variant === "B" && loginHref && (
          <span className="claim-b-login-wrap">
            <span className="claim-b-login-label">Already have an account?</span>
            <a href={loginHref} className="claim-b-login">
              Log in
            </a>
          </span>
        )}
      </header>
      {children}
    </div>
  );
}

function ClaimError({
  title,
  body,
  contact,
}: {
  title: string;
  body: string;
  contact?: { name: string; agency: string | null } | null;
}) {
  return (
    <Shell>
      <div className="claim-error-wrap">
        <div className="claim-error-inner">
          <p className="claim-error-eyebrow">The Sales Progressor</p>
          <h1 className="claim-error-h1">{title}</h1>
          <p className="claim-error-p">{body}</p>
          {contact && (
            <div className="claim-warn-card" style={{ marginTop: 16 }}>
              <p className="claim-warn-p" style={{ margin: 0 }}>
                <strong>Invited by:</strong> {contact.name}
                {contact.agency ? `, ${contact.agency}` : ""}
              </p>
            </div>
          )}
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

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; variant?: string }>;
}) {
  const { token, variant: variantParam } = await searchParams;

  if (!token)
    return <ClaimError title="Invalid invite link" body="This link doesn't look right. Try copying it again, or ask the inviting agent for a new one." />;

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      transactionId: true,
      inviteSentAt: true,
      stubPropertyAddress: true,
      stubAgentEmail: true,
      chain: {
        select: {
          createdByUserId: true,
          createdBy: { select: { name: true, firmName: true, image: true } },
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
              withdrawalStatus: true,
              claimedBy: { select: { firmName: true } },
              transaction: { select: { propertyAddress: true, status: true, photoStoragePath: true } },
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

  const chainBroken = link.chain.links.some(
    (cl) => cl.transaction?.status === "withdrawn" || cl.withdrawalStatus === "WITHDRAWN",
  );
  if (chainBroken) {
    const originatorContactName = link.chain.createdBy?.name ?? "The inviting agent";
    const originatorContactAgency =
      link.chain.createdBy?.firmName ?? link.chain.agency?.name ?? null;
    return (
      <ClaimError
        title="This chain has changed."
        body="A sale in this chain has withdrawn. Ask the inviting agent for a fresh invite once the chain has been resolved."
        contact={{ name: originatorContactName, agency: originatorContactAgency }}
      />
    );
  }

  // A/B experiment: which claim card this invite sees. Frozen deterministic split
  // by link id (see lib/chain/claim-experiment.ts). `?variant=a|b` is a preview
  // override — it changes what renders but records nothing, so it can't skew data.
  const assignedVariant = claimVariantFor(link.id);
  const previewVariant = parseVariantOverride(variantParam);
  const activeVariant = previewVariant ?? assignedVariant;

  // Funnel: this is a genuine view of a live invite — they clicked through from
  // the email and are now seeing the chain. Stamped once. Skipped for previews.
  if (!previewVariant) {
    await recordInviteViewed(link.id, assignedVariant);
  }

  const session = await getServerSession(authOptions);
  const isLoggedIn = !!session?.user;

  let claimHref: string;
  let showLoginLink = false;

  if (isLoggedIn) {
    claimHref = `/claim/confirm?token=${token}`;
  } else {
    const existingUser = link.stubAgentEmail
      ? await prisma.user.findUnique({
          where: { email: link.stubAgentEmail.toLowerCase() },
          select: { id: true },
        })
      : null;
    if (existingUser) {
      claimHref = `/claim/login?token=${token}`;
    } else {
      claimHref = `/claim/signup?token=${token}`;
      showLoginLink = true;
    }
  }

  const chainLinks = link.chain.links;
  const originatorName = link.chain.createdBy?.name ?? "An agent";
  const originatorAgency = link.chain.createdBy?.firmName ?? link.chain.agency?.name ?? null;
  const invitedDate = link.inviteSentAt
    ? new Date(link.inviteSentAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const MAX_VISIBLE = 4;
  const visibleLinks = chainLinks.length <= MAX_VISIBLE ? chainLinks : chainLinks.slice(0, MAX_VISIBLE);
  const ghostCount = chainLinks.length > MAX_VISIBLE ? chainLinks.length - MAX_VISIBLE : 0;

  // ── Variant B: the illustrated card with avatar, photos and pills ──────────
  if (activeVariant === "B") {
    const shaped = visibleLinks.map((cl) => {
      const isYours = cl.id === link.id;
      const isClaimed = cl.transactionId !== null;
      // Claimed links show the real property photo; unclaimed stub links show the
      // internal stub photo (uploaded from the chain drawer), else the placeholder.
      const photoPath = isClaimed
        ? (cl.transaction?.photoStoragePath ?? null)
        : (cl.stubPhotoStoragePath ?? null);
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
    // Batch-sign every property photo in one round trip (claimed + stub).
    const signed = await getSignedUrlMap(shaped.map((r) => r.photoPath));
    const ladder: LadderRow[] = shaped.map((r) => ({
      id: r.id,
      displayNum: r.displayNum,
      status: r.status,
      address: r.address,
      agency: r.agency,
      photoUrl: r.photoPath ? (signed.get(r.photoPath) ?? null) : null,
    }));

    const yourAddress = link.stubPropertyAddress ?? "your sale";
    const inviterImage = link.chain.createdBy?.image ?? null;
    return (
      <Shell variant="B" loginHref={isLoggedIn ? null : `/claim/login?token=${token}`}>
        <ClaimInviteCard
          inviterName={originatorName}
          inviterAgency={originatorAgency}
          inviterAvatarUrl={inviterImage ?? "/claim/tsp-avatar.svg"}
          inviterHasPhoto={!!inviterImage}
          invitedDate={invitedDate}
          yourAddress={yourAddress}
          ladder={ladder}
          ghostCount={ghostCount}
          claimHref={claimHref}
          ctaMicrocopy={
            showLoginLink
              ? `You'll claim ${yourAddress} and create your free account.`
              : `You'll claim ${yourAddress}.`
          }
        />
      </Shell>
    );
  }

  // ── Variant A: the original coral hero card (control) ──────────────────────
  return (
    <Shell>
      <div className="claim-container">
        <div className="claim-hero">
          <p className="claim-hero-eyebrow">
            {originatorAgency
              ? `${originatorName.toUpperCase()} · ${originatorAgency.toUpperCase()}`
              : originatorName.toUpperCase()}
          </p>
          <h1 className="claim-hero-h1">Your sale is part of a live chain.</h1>
          <p className="claim-hero-sub">
            {originatorAgency
              ? `${originatorName} at ${originatorAgency}`
              : originatorName}{" "}
            has linked {link.stubPropertyAddress ?? "your sale"} to their chain. Join to see
            how the other sales are progressing.
          </p>
          <div className="claim-hero-rule" />

          {/* Chain visual — hybrid editorial ladder */}
          <div className="claim-chain">
            {visibleLinks.map((cl, i) => {
              const isYours = cl.id === link.id;
              const isClaimed = cl.transactionId !== null;
              const address = isClaimed
                ? (cl.transaction?.propertyAddress ?? "")
                : isYours
                ? (link.stubPropertyAddress ?? "")
                : (cl.stubPropertyAddress ?? "");
              const agency = cl.claimedBy?.firmName ?? cl.stubAgencyName ?? null;

              return (
                <div key={cl.id}>
                  {i > 0 && (
                    <div className="claim-chain-connector">
                      <div className="claim-chain-connector-dot" />
                      <div className="claim-chain-connector-line" />
                      <div className="claim-chain-connector-dot" />
                    </div>
                  )}
                  <div className="claim-chain-row">
                    <div className="claim-chain-gutter">
                      <span className="claim-chain-num">
                        {String(displayChainPosition(cl.position, chainLinks.length)).padStart(2, "0")}
                      </span>
                    </div>
                    <div
                      className={`claim-chain-card ${
                        isYours
                          ? "claim-chain-card--yours"
                          : isClaimed
                          ? "claim-chain-card--claimed"
                          : "claim-chain-card--pending"
                      }`}
                    >
                      {isYours ? (
                        <>
                          <div className="claim-chain-head">
                            <span className="claim-chain-address">{address || "Your sale"}</span>
                            <span className="claim-chain-status">YOU</span>
                          </div>
                          <div className="claim-chain-inner">
                            <span className="claim-chain-inner-text">
                              Your sale · Claim to join
                            </span>
                            <span className="claim-chain-inner-arrow">→</span>
                          </div>
                        </>
                      ) : isClaimed ? (
                        <>
                          <div className="claim-chain-head">
                            <span className="claim-chain-address">{address}</span>
                            <span className="claim-chain-status">✓ Joined</span>
                          </div>
                          {agency && (
                            <div className="claim-chain-agency">{agency}</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="claim-chain-head">
                            {address ? (
                              <span className="claim-chain-address">{address}</span>
                            ) : (
                              <span
                                className="claim-chain-address"
                                style={{
                                  color: "rgba(255,255,255,.5)",
                                  fontStyle: "italic",
                                  fontWeight: 400,
                                }}
                              >
                                Invite pending
                              </span>
                            )}
                            <span className="claim-chain-status">Invite sent</span>
                          </div>
                          {agency && <div className="claim-chain-agency">{agency}</div>}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {ghostCount > 0 && (
              <>
                <div className="claim-chain-connector">
                  <div className="claim-chain-connector-dot" />
                  <div className="claim-chain-connector-line" />
                  <div className="claim-chain-connector-dot" />
                </div>
                <div className="claim-chain-row">
                  <div className="claim-chain-gutter">
                    <span className="claim-chain-num" style={{ fontSize: 14, opacity: 0.5 }}>
                      ··
                    </span>
                  </div>
                  <div className="claim-chain-card claim-chain-card--ghost">
                    <span
                      className="claim-chain-address"
                      style={{ color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 400 }}
                    >
                      and {ghostCount} more
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Meta strip */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,.15)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span style={{ fontSize: 11, color: "rgba(255,255,255,.60)" }}>
              Invited by:{" "}
              <strong style={{ color: "rgba(255,255,255,.85)" }}>{originatorName}</strong>
              {originatorAgency ? `, ${originatorAgency}` : ""}
            </span>
            {invitedDate && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.50)" }}>
                Invited on: {invitedDate}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="claim-cta" style={{ marginTop: 20 }}>
          <ClaimCtaButton href={claimHref}>Claim this sale</ClaimCtaButton>
          <p className="claim-microcopy">Free 14-day trial · No card needed · Secure &amp; private</p>
          {showLoginLink && (
            <p className="claim-link-row">
              Already have an account?{" "}
              <a href={`/claim/login?token=${token}`}>Log in</a>
            </p>
          )}
          {isLoggedIn && (
            <p className="claim-microcopy">Logged in as {session.user.email}</p>
          )}
          <a href={`/claim/decline?token=${token}`} className="claim-decline-link">
            This isn&apos;t mine. Decline invite
          </a>
        </div>
      </div>
    </Shell>
  );
}
