import { prisma } from "@/lib/prisma";
import "../styles/claim-flow.css";

// Performs the decline on page load (side effect in server component, mirrors
// the previous GET route behaviour). Idempotent — safe to reload.
export default async function ClaimDeclinePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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

  if (!token) {
    return (
      <Shell>
        <div className="claim-error-wrap">
          <div className="claim-error-inner">
            <p className="claim-error-eyebrow">The Sales Progressor</p>
            <h1 className="claim-error-h1">Invalid link</h1>
            <p className="claim-error-p">This link is invalid or has expired.</p>
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

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      transactionId: true,
      stubPropertyAddress: true,
      createdByUserId: true,
      chain: {
        select: {
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!link) {
    return (
      <Shell>
        <div className="claim-error-wrap">
          <div className="claim-error-inner">
            <p className="claim-error-eyebrow">The Sales Progressor</p>
            <h1 className="claim-error-h1">Invalid link</h1>
            <p className="claim-error-p">
              This link is invalid or has already been used.
            </p>
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

  if (link.transactionId !== null) {
    return (
      <Shell>
        <div className="claim-error-wrap">
          <div className="claim-error-inner">
            <p className="claim-error-eyebrow">The Sales Progressor</p>
            <h1 className="claim-error-h1">This sale has been claimed.</h1>
            <p className="claim-error-p">No need to decline — someone has already joined.</p>
          </div>
        </div>
      </Shell>
    );
  }

  const isExpired = link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date();

  if (isExpired) {
    return (
      <Shell>
        <div className="claim-decline-wrap">
          <div className="claim-decline-bloom" />
          <div className="claim-decline-body">
            <h1 className="claim-decline-h1">This invite has expired.</h1>
            <p className="claim-decline-sub">
              The link was valid for 7 days. No action needed — we haven&apos;t notified anyone.
            </p>
            <p className="claim-about">
              What is The Sales Progressor? Estate agents use it to track every sale in a chain
              together — so everyone knows where the hold-up is before they pick up the phone.
            </p>
            <p className="claim-support">
              Questions?{" "}
              <a href="mailto:support@thesalesprogressor.co.uk">
                support@thesalesprogressor.co.uk
              </a>
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // Already declined — idempotent render
  if (link.inviteStatus === "DECLINED") {
    const expiryDate = link.inviteTokenExpiresAt
      ? new Date(link.inviteTokenExpiresAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

    return (
      <Shell>
        <div className="claim-decline-wrap">
          <div className="claim-decline-bloom" />
          <div className="claim-decline-body">
            <h1 className="claim-decline-h1">Already noted.</h1>
            <p className="claim-decline-sub">
              We already let them know. Nothing more needed from you.
            </p>
            {expiryDate && (
              <div className="claim-nudge-card">
                <p className="claim-nudge-text">
                  Changed your mind? This link is valid until {expiryDate}.
                </p>
                <a href={`/claim?token=${token}`} className="claim-btn claim-btn--ghost">
                  Claim after all
                </a>
              </div>
            )}
            <p className="claim-about">
              What is The Sales Progressor? Estate agents use it to track every sale in a chain
              together — so everyone knows where the hold-up is before they pick up the phone.
            </p>
            <p className="claim-support">
              Questions?{" "}
              <a href="mailto:support@thesalesprogressor.co.uk">
                support@thesalesprogressor.co.uk
              </a>
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // Perform the decline
  await prisma.chainLink.update({
    where: { id: link.id },
    data: { inviteStatus: "DECLINED", inviteDeclinedAt: new Date() },
  });

  if (link.createdByUserId) {
    await prisma.user
      .update({
        where: { id: link.createdByUserId },
        data: {
          chainDeclineNotificationAddress: link.stubPropertyAddress ?? "a sale",
          chainDeclineNotificationAt: new Date(),
        },
      })
      .catch((err) => console.error("Failed to set chain decline notification:", err));
  }

  const expiryDate = link.inviteTokenExpiresAt
    ? new Date(link.inviteTokenExpiresAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Shell>
      <div className="claim-decline-wrap">
        <div className="claim-decline-bloom" />
        <div className="claim-decline-body">
          <h1 className="claim-decline-h1">All noted.</h1>
          <p className="claim-decline-sub">
            We&apos;ve let them know this isn&apos;t your sale. Estate agencies are busy —
            thanks for letting us know.
          </p>
          {expiryDate && (
            <div className="claim-nudge-card">
              <p className="claim-nudge-text">
                Changed your mind? This link is valid until {expiryDate}.
              </p>
              <a href={`/claim?token=${token}`} className="claim-btn claim-btn--ghost">
                Claim after all
              </a>
            </div>
          )}
          <p className="claim-about">
            What is The Sales Progressor? Estate agents use it to track every sale in a chain
            together — so everyone knows where the hold-up is before they pick up the phone.
          </p>
          <p className="claim-support">
            Questions?{" "}
            <a href="mailto:support@thesalesprogressor.co.uk">
              support@thesalesprogressor.co.uk
            </a>
          </p>
        </div>
      </div>
    </Shell>
  );
}
