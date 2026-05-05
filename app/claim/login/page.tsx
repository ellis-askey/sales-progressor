import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClaimLoginForm } from "@/components/claim/ClaimLoginForm";

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

export default async function ClaimLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage title="Invalid link" body="This link is invalid or has expired." />;
  }

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
      stubAgentEmail: true,
      stubPropertyAddress: true,
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

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
      </div>

      <div style={{ maxWidth: 420, margin: "0 auto", padding: "40px 24px 60px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1d29", margin: "0 0 8px", textAlign: "center" }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: "#8b91a3", textAlign: "center", margin: "0 0 28px" }}>
          Log in to claim your position in this chain
        </p>

        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <ClaimLoginForm
            token={token}
            stubEmail={link.stubAgentEmail ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
