import { prisma } from "@/lib/prisma";
import { NegotiatorPasswordForm } from "./NegotiatorPasswordForm";

export default async function NegotiatorInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.negotiatorInvitation.findUnique({
    where: { token },
    include: { agency: { select: { name: true } }, invitedBy: { select: { name: true } } },
  });

  const cardStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #fdf6f0 0%, #fff8f5 100%)",
    padding: "24px",
  };

  const innerStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 4px 40px rgba(255,107,74,0.10), 0 1px 4px rgba(0,0,0,0.06)",
    padding: "40px 36px",
    width: "100%",
    maxWidth: 440,
  };

  if (!invitation) {
    return (
      <div style={cardStyle}>
        <div style={innerStyle}>
          <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1a1d29" }}>
            Invalid invitation
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            This invitation link is invalid. Please ask your director to send a new one.
          </p>
        </div>
      </div>
    );
  }

  if (invitation.acceptedAt) {
    return (
      <div style={cardStyle}>
        <div style={innerStyle}>
          <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1a1d29" }}>
            Already accepted
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            This invitation has already been accepted. You can{" "}
            <a href="/login" style={{ color: "#FF6B4A", fontWeight: 600 }}>sign in</a> to continue.
          </p>
        </div>
      </div>
    );
  }

  if (invitation.expiresAt < new Date()) {
    return (
      <div style={cardStyle}>
        <div style={innerStyle}>
          <p style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#1a1d29" }}>
            Invitation expired
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
            This invitation link has expired. Please ask {invitation.invitedBy.name} to resend it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={innerStyle}>
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44,
            background: "linear-gradient(135deg,#FF6B4A 0%,#e85535 100%)",
            borderRadius: 12, marginBottom: 20,
          }} />
          <p style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "#1a1d29", letterSpacing: "-0.02em" }}>
            Welcome to {invitation.agency.name}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>
            {invitation.invitedBy.name} has added you as a negotiator. Set your password to get started.
          </p>
        </div>

        <NegotiatorPasswordForm
          token={token}
          negotiatorEmail={invitation.negotiatorEmail}
          defaultName={invitation.negotiatorName}
        />
      </div>
    </div>
  );
}
