import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClaimLoginForm } from "@/components/claim/ClaimLoginForm";
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

export default async function ClaimLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token)
    return <ClaimError title="Invalid invite link" body="This link doesn't look right. Try copying it again, or ask the inviting agent for a new one." />;

  // Already logged in — go straight to confirm
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect(`/claim/confirm?token=${token}`);
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

  const stubEmail = link.stubAgentEmail ?? "";

  const milestoneDefinitions = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    select: { id: true, code: true, name: true, side: true, orderIndex: true },
  });

  return (
    <Shell>
      <div className="claim-container--narrow">
        <div className="claim-context-strip">
          <a href={`/claim?token=${token}`} className="claim-context-back">
            ← Back
          </a>
          <div className="claim-context-info">
            <div className="claim-context-label">Claiming:</div>
            <div className="claim-context-address">
              {link.stubPropertyAddress ?? "Your sale"}
            </div>
          </div>
        </div>

        <h1 className="claim-sub-h1">Log in to claim</h1>
        <p className="claim-sub-p">
          There&apos;s already an account for <strong>{stubEmail}</strong>. Log in to link your sale.
        </p>

        <div className="claim-form-card">
          <ClaimLoginForm
            token={token}
            stubEmail={stubEmail}
            milestoneDefinitions={milestoneDefinitions}
          />
        </div>

        <p className="claim-link-row" style={{ marginTop: 16 }}>
          New agent?{" "}
          <a href={`/claim/signup?token=${token}`}>Create an account instead</a>
        </p>
      </div>
    </Shell>
  );
}
