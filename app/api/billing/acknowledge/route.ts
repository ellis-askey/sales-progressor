// POST /api/billing/acknowledge
//
// Director clicks "I understand, billed monthly on exchange" on the disclosure.
// Writes a PricingAcknowledgement row pointing at the currently-active
// TermsVersion (whichever row the page server-side resolved when it
// rendered the disclosure body).
//
// Validates: caller is a director, has an agencyId, supplied termsVersionId
// matches the currently active TermsVersion (defence against an inflight
// disclosure swap between page-load and click).
//
// Idempotent: if the agency has already acknowledged this exact terms
// version, returns ok without inserting a duplicate.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getActiveTermsVersion,
  hasAcknowledged,
  recordAcknowledgement,
} from "@/lib/billing/acknowledgement";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "director") {
    return NextResponse.json({ error: "Director only" }, { status: 403 });
  }
  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json({ error: "No agency on session" }, { status: 400 });
  }

  const { termsVersionId } = (await req.json().catch(() => ({}))) as { termsVersionId?: string };
  if (!termsVersionId) {
    return NextResponse.json({ error: "termsVersionId required" }, { status: 400 });
  }

  // Defence: refuse to record acknowledgement against a TermsVersion that
  // isn't currently the active one. Prevents recording against a stale
  // copy if Ellis swaps the terms while the disclosure is open in the
  // director's browser.
  const active = await getActiveTermsVersion();
  if (!active) {
    return NextResponse.json({ error: "No active terms" }, { status: 409 });
  }
  if (active.id !== termsVersionId) {
    return NextResponse.json(
      { error: "Terms updated since this page loaded — please refresh and re-read" },
      { status: 409 },
    );
  }

  if (await hasAcknowledged(agencyId, termsVersionId)) {
    return NextResponse.json({ ok: true, alreadyAcknowledged: true });
  }

  const row = await recordAcknowledgement({
    agencyId,
    userId: session.user.id,
    userName: session.user.name ?? "(name unknown)",
    userEmail: session.user.email ?? "(email unknown)",
    termsVersionId,
  });

  return NextResponse.json({ ok: true, acknowledgementId: row.id });
}
