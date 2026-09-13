import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moveInvitesEnabled } from "@/lib/auth/move-invites";
import { MoveInviteClient } from "./MoveInviteClient";

// Self-contained confirm page for invite-to-move. Deliberately NOT wired into the
// public negotiator-invite landing (which only supports OAuth / set-a-password
// for brand-new users). The invited person already has an account, so they sign
// in normally and open this link to confirm. See docs/active/invite-to-move/SPEC.md.

const shell = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", background: "#F4F4F6" } as const,
  card: { width: "100%", maxWidth: 440, background: "#fff", borderRadius: 16, padding: "2.25rem 2rem", boxShadow: "0 10px 40px rgba(32,36,46,0.10)", textAlign: "center" } as const,
  h1: { margin: "0 0 12px", fontSize: 20, fontWeight: 700, color: "#20242E", letterSpacing: "-0.01em", lineHeight: 1.25 } as const,
  p: { margin: "0 0 20px", fontSize: 14, lineHeight: 1.6, color: "rgba(32,36,46,0.62)" } as const,
  link: { display: "inline-block", padding: "11px 22px", borderRadius: 10, background: "#FF6B4A", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" } as const,
};

function Card({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div style={shell.wrap}>
      <div style={shell.card}>
        <h1 style={shell.h1}>{title}</h1>
        <p style={shell.p}>{body}</p>
        {cta && <a href={cta.href} style={shell.link}>{cta.label}</a>}
      </div>
    </div>
  );
}

export default async function MoveInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!moveInvitesEnabled()) redirect("/login");

  const invitation = await prisma.negotiatorInvitation.findUnique({
    where: { token },
    select: {
      negotiatorEmail: true,
      acceptedAt: true,
      cancelledAt: true,
      expiresAt: true,
      agency: { select: { name: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation || invitation.cancelledAt) {
    return <Card title="Invitation not found" body="This invitation link is no longer valid. Ask the person who invited you to send a new one." cta={{ href: "/login", label: "Go to sign in" }} />;
  }
  if (invitation.acceptedAt) {
    return <Card title="Already used" body="This invitation has already been used. Sign in to your account to continue." cta={{ href: "/login", label: "Go to sign in" }} />;
  }
  if (invitation.expiresAt < new Date()) {
    return <Card title="Invitation expired" body="This invitation link has expired. Ask the person who invited you to send a new one." cta={{ href: "/login", label: "Go to sign in" }} />;
  }

  const session = await getServerSession(authOptions);
  const agencyName = invitation.agency.name;
  const invitedByName = invitation.invitedBy?.name ?? "Your agency";

  if (!session?.user) {
    return (
      <Card
        title={`Join ${agencyName}?`}
        body={`Sign in to your Sales Progressor account, then open this link again to confirm your move to ${agencyName}.`}
        cta={{ href: "/login", label: "Go to sign in" }}
      />
    );
  }

  const emailMatch = session.user.email?.toLowerCase() === invitation.negotiatorEmail.toLowerCase();
  if (!emailMatch) {
    return (
      <MoveInviteClient
        token={token}
        agencyName={agencyName}
        invitedByName={invitedByName}
        mismatchEmail={session.user.email ?? ""}
        inviteEmail={invitation.negotiatorEmail}
      />
    );
  }

  return <MoveInviteClient token={token} agencyName={agencyName} invitedByName={invitedByName} />;
}
