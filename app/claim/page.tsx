import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) return <ErrorPage title="Invalid link" body="This link is invalid or has expired." />;

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      inviteStatus: true,
      inviteTokenExpiresAt: true,
      transactionId: true,
      inviteSentAt: true,
      stubPropertyAddress: true,
      stubAgencyName: true,
      stubAgentEmail: true,
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
              stubPropertyAddress: true,
              claimedBy: { select: { firmName: true } },
              transaction: { select: { propertyAddress: true } },
            },
          },
        },
      },
    },
  });

  if (!link) return <ErrorPage title="Invalid link" body="This link is invalid or has already been used. Contact the inviting agent for a fresh invite." />;
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED") return <ErrorPage title="Already claimed" body="This chain link has already been claimed. If you believe this is a mistake, contact support." />;
  if (link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date()) return <ErrorPage title="This invite has expired." body="The link was valid for 7 days after it was sent. Ask the inviting agent to resend it." />;

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
  const stubLinkIndex = chainLinks.findIndex((l) => l.id === link.id);
  const stubPosition = stubLinkIndex + 1;
  const totalLinks = chainLinks.length;
  const originatorName = link.chain.createdBy?.name ?? "An agent";
  const originatorAgency = link.chain.createdBy?.firmName ?? link.chain.agency?.name ?? null;
  const invitedDate = link.inviteSentAt
    ? new Date(link.inviteSentAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 60px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1a1d29", margin: "0 0 8px", textAlign: "center" }}>
          You've been invited to join this chain
        </h1>
        <p style={{ fontSize: 14, color: "#8b91a3", textAlign: "center", margin: "0 0 32px", lineHeight: 1.6 }}>
          {originatorAgency ? `${originatorName} at ${originatorAgency}` : originatorName} has linked your sale to theirs
        </p>

        {/* Chain teaser card */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "20px", marginBottom: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8b91a3" }}>Your position</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1d29" }}>
              #{stubPosition} of {totalLinks} in this chain
            </p>
          </div>

          {/* Chain links */}
          <div>
            {chainLinks.map((chainLink, i) => {
              const isThisStub = chainLink.id === link.id;
              const isClaimed = chainLink.transactionId !== null;
              const address = isClaimed
                ? (chainLink.transaction?.propertyAddress ?? "")
                : isThisStub
                ? (link.stubPropertyAddress ?? "")
                : "";
              const agencyName = chainLink.claimedBy?.firmName ?? null;

              return (
                <div key={chainLink.id}>
                  {i > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", height: 14 }}>
                      <div style={{ width: 1, background: "#e2e8f0" }} />
                    </div>
                  )}
                  {isThisStub ? (
                    <div style={{ border: "2px solid #FF6B4A", borderRadius: 10, padding: "11px 14px", background: "#FFF8F6" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1d29", wordBreak: "break-word" }}>{address || "Your sale"}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6B4A" }}>Your sale</span>
                        <span style={{ fontSize: 11, color: "#8b91a3" }}>· Claim to view progress</span>
                      </div>
                    </div>
                  ) : isClaimed ? (
                    <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: "11px 14px", background: "#f0fdf4" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1d29", wordBreak: "break-word" }}>{address}</p>
                      {agencyName && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4a5162" }}>{agencyName}</p>}
                      <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, color: "#059669", background: "#d1fae5", padding: "2px 8px", borderRadius: 99 }}>Tracking</span>
                    </div>
                  ) : (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "11px 14px", background: "#f8fafc" }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>Sale pending — details private</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Invited by */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 2px", fontSize: 12, color: "#8b91a3" }}>
              Invited by: <strong style={{ color: "#4a5162" }}>{originatorName}</strong> — {originatorAgency}
            </p>
            {invitedDate && (
              <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>Invited on: {invitedDate}</p>
            )}
          </div>
        </div>

        {/* Benefits */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#4a5162", textAlign: "center" }}>
            By joining, you'll be able to:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              "View the full chain structure",
              "See live milestone progress on every sale",
              "Understand what's holding the chain up",
              "Update your own file and keep other agents informed",
            ].map((benefit) => (
              <div key={benefit} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 13, color: "#4a5162" }}>{benefit}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#8b91a3", textAlign: "center" }}>
            Free to use · Takes 30 seconds
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <a
            href={claimHref}
            style={{ display: "block", width: "100%", textAlign: "center", background: "#FF6B4A", color: "#fff", padding: "14px 28px", borderRadius: 12, textDecoration: "none", fontWeight: 700, fontSize: 15, boxSizing: "border-box" }}
          >
            Claim this sale
          </a>

          {showLoginLink && (
            <p style={{ margin: 0, fontSize: 13, color: "#8b91a3" }}>
              Already have an account?{" "}
              <a href={`/claim/login?token=${token}`} style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}>
                Log in
              </a>
            </p>
          )}

          {isLoggedIn && (
            <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>
              Logged in as {session.user.email}
            </p>
          )}

          <a
            href={`/claim/decline?token=${token}`}
            style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none" }}
          >
            This isn&apos;t mine — decline invite
          </a>
        </div>
      </div>
    </div>
  );
}
