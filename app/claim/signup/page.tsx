import { prisma } from "@/lib/prisma";
import { ClaimSignupForm } from "@/components/claim/ClaimSignupForm";
import "../styles/claim-flow.css";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="claim-page">
      <header className="claim-header">
        <span className="claim-wordmark">The Sales Progressor</span>
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
        body="The link was valid for 7 days after it was sent. Ask the inviting agent to resend it."
      />
    );

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
  const panelLinks =
    chainLinks.length <= MAX_PANEL_LINKS ? chainLinks : chainLinks.slice(0, MAX_PANEL_LINKS);
  const panelGhostCount =
    chainLinks.length > MAX_PANEL_LINKS ? chainLinks.length - MAX_PANEL_LINKS : 0;

  const milestoneDefinitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    select: { id: true, code: true, name: true, side: true, orderIndex: true, blocksExchange: true },
  });

  return (
    <Shell>
      <div className="claim-signup-grid">
        {/* ── Left column — form ── */}
        <div>
          <h1 className="claim-sub-h1">Create your account</h1>
          <p className="claim-sub-p">Join free — no card required.</p>

          <div className="claim-form-card">
            <ClaimSignupForm
              token={token}
              stubEmail={link.stubAgentEmail ?? ""}
              stubAgencyName={link.stubAgencyName ?? ""}
              milestoneDefinitions={milestoneDefinitions}
            />
          </div>

          <p className="claim-link-row" style={{ marginTop: 16 }}>
            Already have an account?{" "}
            <a href={`/claim/login?token=${token}`}>Log in instead</a>
          </p>
        </div>

        {/* ── Right column — chain panel ── */}
        <div className="claim-panel">
          <p className="claim-panel-eyebrow">You&apos;re joining the chain at</p>
          <p className="claim-panel-address">
            {link.stubPropertyAddress ?? "Your sale"}
          </p>
          <div className="claim-panel-rule" />

          {/* Mini chain visual */}
          <div className="claim-chain">
            {panelLinks.map((cl, i) => {
              const isYours = cl.id === link.id;
              const isClaimed = cl.transactionId !== null;
              const address = isClaimed
                ? (cl.transaction?.propertyAddress ?? "")
                : isYours
                ? (link.stubPropertyAddress ?? "")
                : "";
              const agency = cl.claimedBy?.firmName ?? null;

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
                        {String(cl.position).padStart(2, "0")}
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
                            <span className="claim-chain-address">
                              {address || "Your sale"}
                            </span>
                            <span className="claim-chain-status">YOU</span>
                          </div>
                          <div className="claim-chain-inner">
                            <span className="claim-chain-inner-text">Your sale</span>
                          </div>
                        </>
                      ) : isClaimed ? (
                        <>
                          <div className="claim-chain-head">
                            <span className="claim-chain-address">{address}</span>
                            <span className="claim-chain-status">✓</span>
                          </div>
                          {agency && <div className="claim-chain-agency">{agency}</div>}
                        </>
                      ) : (
                        <div className="claim-chain-head">
                          <span
                            className="claim-chain-address"
                            style={{
                              color: "rgba(255,255,255,.5)",
                              fontStyle: "italic",
                              fontWeight: 400,
                            }}
                          >
                            Pending
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {panelGhostCount > 0 && (
              <>
                <div className="claim-chain-connector">
                  <div className="claim-chain-connector-dot" />
                  <div className="claim-chain-connector-line" />
                  <div className="claim-chain-connector-dot" />
                </div>
                <div className="claim-chain-row">
                  <div className="claim-chain-gutter">
                    <span
                      className="claim-chain-num"
                      style={{ fontSize: 14, opacity: 0.5 }}
                    >
                      ··
                    </span>
                  </div>
                  <div className="claim-chain-card claim-chain-card--ghost">
                    <span
                      className="claim-chain-address"
                      style={{
                        color: "rgba(255,255,255,.4)",
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      — and {panelGhostCount} more —
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <p className="claim-panel-invite">
            Invited by {originatorName}
            {originatorAgency ? ` · ${originatorAgency}` : ""}
            {invitedDate ? ` · ${invitedDate}` : ""}
          </p>
        </div>
      </div>
    </Shell>
  );
}
