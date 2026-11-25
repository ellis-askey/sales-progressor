// POST /api/command/proposal — founder-only administration for the Boardwalk
// proposal microsite (rotate password, revoke sessions, turn the proposal off,
// revoke/restore an invitation, seed the default links). Superadmin-gated, like
// every Command Centre action.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { recordAdminActionSafe } from "@/lib/command/audit/write";
import {
  rotatePassword,
  revokeAllSessions,
  setProposalRevoked,
  setInvitationRevoked,
} from "@/lib/proposal/analytics";
import { ensureSeedInvitations } from "@/lib/proposal/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    switch (action) {
      case "rotate_password": {
        const password = typeof body?.password === "string" ? body.password.trim() : "";
        if (password.length < 4) {
          return NextResponse.json({ error: "Password must be at least 4 characters." }, { status: 400 });
        }
        await rotatePassword(password);
        break;
      }
      case "revoke_all_sessions":
        await revokeAllSessions();
        break;
      case "set_revoked":
        await setProposalRevoked(body?.revoked === true);
        break;
      case "set_invitation_revoked": {
        const id = typeof body?.invitationId === "string" ? body.invitationId : "";
        if (!id) return NextResponse.json({ error: "invitationId required" }, { status: 400 });
        await setInvitationRevoked(id, body?.revoked === true);
        break;
      }
      case "seed_invitations":
        await ensureSeedInvitations();
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[command-proposal]", err);
    return NextResponse.json(
      { error: "Something went wrong. The proposal tables may not be migrated yet." },
      { status: 500 },
    );
  }

  await recordAdminActionSafe({
    adminUserId: session.user.id,
    action: `command.proposal.${action}`,
    targetType: "proposal",
    targetId: "boardwalk",
  });

  return NextResponse.json({ ok: true });
}
