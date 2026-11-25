// POST /api/proposal/logout — clears the proposal session cookie.

import { NextResponse } from "next/server";
import { clearProposalSessionCookie } from "@/lib/proposal/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearProposalSessionCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
