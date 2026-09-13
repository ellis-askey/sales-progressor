"use server";

import { requireSession } from "@/lib/session";
import { moveInvitesEnabled } from "@/lib/auth/move-invites";
import { acceptMoveInvite, type MoveOutcome } from "@/lib/services/agency-moves";

// Consent-guarded accept for an invite-to-move. requireSession proves the caller
// is authenticated; the service re-checks that their email matches the invite
// before moving anything. See docs/active/invite-to-move/SPEC.md.
export async function acceptMoveInviteAction(token: string): Promise<MoveOutcome> {
  if (!moveInvitesEnabled()) return { ok: false, error: "This isn't available right now." };
  const session = await requireSession();
  if (!session?.user?.id || !session.user.email) {
    return { ok: false, error: "Please sign in and try again." };
  }
  return acceptMoveInvite({
    token,
    sessionUserId: session.user.id,
    sessionEmail: session.user.email,
  });
}
