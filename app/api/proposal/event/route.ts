// POST /api/proposal/event — first-party engagement beacon.
//
// Records WHICH section/calculator a reader engaged with, never the financial
// inputs they typed. Every write is best-effort. A "visit" ping resolves the
// browsing occasion (rotating the analytics session after an idle gap) so the
// cookie rotation happens inside a route handler, where cookies can be set.

import { NextResponse } from "next/server";
import { getProposalSession, setProposalSessionCookie } from "@/lib/proposal/auth";
import { requestMeta, resolveVisit, touchSession, recordEvent } from "@/lib/proposal/access";
import { PROPOSAL_EVENT_KINDS, type ProposalEventKind } from "@/lib/proposal/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
const clip = (s: unknown, max = 64): string | undefined =>
  typeof s === "string" && s.trim() ? s.trim().slice(0, max) : undefined;

export async function POST(req: Request) {
  const session = await getProposalSession();
  // No session → silently accept so a stale beacon never surfaces an error.
  if (!session) return new NextResponse(null, { status: 204, headers: noStore });

  const body = await req.json().catch(() => ({}));
  const isVisit = body?.visit === true;
  const rawKind = typeof body?.kind === "string" ? body.kind : null;
  const kind: ProposalEventKind | null =
    rawKind && (PROPOSAL_EVENT_KINDS as string[]).includes(rawKind) ? (rawKind as ProposalEventKind) : null;
  const sectionId = clip(body?.sectionId, 48);
  const detail = clip(body?.detail, 64);

  let sid = session.sid;

  if (isVisit) {
    const meta = requestMeta(req);
    const res = await resolveVisit(session.sid, session.inviteId, meta);
    sid = res.sessionId;
    if (res.sessionId && res.sessionId !== session.sid) {
      await setProposalSessionCookie({ ...session, sid: res.sessionId, issuedAt: Date.now() });
    }
  } else {
    await touchSession(sid);
  }

  if (kind) {
    await recordEvent(sid, session.inviteId, kind, { sectionId, detail });
  }

  return new NextResponse(null, { status: 204, headers: noStore });
}
