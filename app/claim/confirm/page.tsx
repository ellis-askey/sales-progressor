import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findDuplicateTransactions } from "@/lib/chain/duplicate-detection";
import { ClaimConfirmForm } from "@/components/claim/ClaimConfirmForm";

function ErrorPage({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: "0 24px" }}>
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#FF6B4A" }}>The Sales Progressor</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1d29", margin: "0 0 12px" }}>{title}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "#4a5162", margin: "0 0 20px" }}>{body}</p>
        <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>
          Need help?{" "}
          <a href="mailto:support@thesalesprogressor.co.uk" style={{ color: "#3b82f6" }}>
            support@thesalesprogressor.co.uk
          </a>
        </p>
      </div>
    </div>
  );
}

export default async function ClaimConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage title="Invalid link" body="This link is invalid or has expired." />;
  }

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
      stubAgentEmail: true,
      stubPropertyAddress: true,
      chain: { select: { createdByUserId: true } },
    },
  });

  if (!link) {
    return (
      <ErrorPage
        title="Invalid link"
        body="This link is invalid or has already been used. Contact the inviting agent for a fresh invite."
      />
    );
  }
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED") {
    return (
      <ErrorPage
        title="Already claimed"
        body="This chain link has already been claimed. If you believe this is a mistake, contact support."
      />
    );
  }

  // Self-claim guard
  if (link.chain.createdByUserId === session.user.id) {
    return (
      <ErrorPage
        title="Can't claim your own invite"
        body="You created this chain. You can't claim an invite you sent."
      />
    );
  }

  // Email mismatch
  const userEmail = session.user.email?.toLowerCase().trim();
  const stubEmail = link.stubAgentEmail?.toLowerCase().trim();
  const emailMismatch = !userEmail || !stubEmail || userEmail !== stubEmail;

  if (emailMismatch) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
        </div>
        <div style={{ maxWidth: 460, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1d29", margin: "0 0 12px" }}>Wrong account</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#4a5162", margin: "0 0 20px" }}>
            This invite was sent to{" "}
            <strong>{link.stubAgentEmail}</strong>. You&apos;re logged in as{" "}
            <strong>{session.user.email}</strong>.
          </p>
          <p style={{ fontSize: 14, color: "#4a5162", margin: "0 0 24px", lineHeight: 1.7 }}>
            If you should have received this invite at your account email, ask the inviting agent to resend the invite to{" "}
            <strong>{session.user.email}</strong>.
          </p>
          <a
            href="/api/auth/signout"
            style={{ display: "inline-block", background: "#f1f5f9", color: "#4a5162", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600, marginRight: 8 }}
          >
            Log out and try a different account
          </a>
          <a
            href={`/claim?token=${token}`}
            style={{ display: "inline-block", fontSize: 13, color: "#8b91a3", textDecoration: "none", marginTop: 8 }}
          >
            Cancel
          </a>
        </div>
      </div>
    );
  }

  // Duplicate detection — only if stub has an address
  const agencyId = session.user.agencyId;
  const stubAddress = link.stubPropertyAddress ?? "";
  const duplicateMatches = stubAddress && agencyId
    ? await findDuplicateTransactions(agencyId, stubAddress)
    : [];

  // Enrich duplicates with created date
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

  const hasDuplicates = enrichedMatches.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px 60px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1d29", margin: "0 0 8px", textAlign: "center" }}>
          {hasDuplicates ? "You already have a file for this property" : "Claim this sale"}
        </h1>
        {!hasDuplicates && stubAddress && (
          <p style={{ fontSize: 14, color: "#8b91a3", textAlign: "center", margin: "0 0 28px" }}>
            You&apos;re claiming{" "}
            <strong style={{ color: "#1a1d29" }}>{stubAddress}</strong>{" "}
            as part of this chain.
          </p>
        )}
        {hasDuplicates && (
          <p style={{ fontSize: 14, color: "#4a5162", textAlign: "center", margin: "0 0 28px", lineHeight: 1.6 }}>
            We found a transaction in your dashboard that matches the property address in this invite.
          </p>
        )}

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <ClaimConfirmForm
            token={token}
            stubAddress={stubAddress}
            duplicates={enrichedMatches.map((m) => ({
              transactionId: m.transactionId,
              propertyAddress: m.propertyAddress,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
