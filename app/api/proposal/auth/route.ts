// POST /api/proposal/auth — validates the shared access password server-side,
// mints the proposal session cookie, and opens an analytics session.
//
// The password is never shipped to the client. Brute-force protection is a
// DB-backed per-IP lockout (lib/proposal/access.ts), which works on serverless
// where an in-memory counter would not; an in-memory fallback covers the window
// before the migration is applied.

import { NextResponse } from "next/server";
import {
  verifyProposalPassword,
  setProposalSessionCookie,
} from "@/lib/proposal/auth";
import {
  requestMeta,
  isLockedOut,
  recordAuthAttempt,
  createSession,
  recordEvent,
} from "@/lib/proposal/access";
import { resolveInvitation } from "@/lib/proposal/invitations";
import { PROPOSAL_SLUG } from "@/lib/proposal/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(req: Request) {
  const meta = requestMeta(req);

  if (await isLockedOut(meta.ipHash)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: noStore },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  const inviteToken = typeof body?.invite === "string" ? body.invite : null;

  const check = await verifyProposalPassword(password);
  await recordAuthAttempt(meta.ipHash, check.ok);

  if (check.revoked) {
    return NextResponse.json(
      { error: "This proposal is no longer available." },
      { status: 403, headers: noStore },
    );
  }
  if (!check.ok) {
    return NextResponse.json(
      { error: "That password isn't right." },
      { status: 401, headers: noStore },
    );
  }

  const invitation = await resolveInvitation(inviteToken);
  const invitationId = invitation && !invitation.revoked ? invitation.id : null;

  const sid = await createSession(meta, invitationId);
  await setProposalSessionCookie({
    slug: PROPOSAL_SLUG,
    inviteId: invitationId,
    sid,
    epoch: check.epoch,
    issuedAt: Date.now(),
  });
  await recordEvent(sid, invitationId, "auth_success");

  return NextResponse.json({ ok: true }, { headers: noStore });
}
