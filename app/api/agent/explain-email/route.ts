// POST /api/agent/explain-email
//
// Staff-facing twin of the portal explain-email tool, so an agent can try the
// client AI email helper themselves (e.g. from Account → Client portal) before
// deciding whether to leave it on for their buyers and sellers. Session-authed
// (any signed-in staff member); reuses the same shared prompt so the output is
// identical to what a client sees. Nothing is stored.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { callClaude } from "@/lib/anthropic";
import { authOptions } from "@/lib/auth";
import { EXPLAIN_EMAIL_SYSTEM_PROMPT, buildExplainEmailUserMessage } from "@/lib/ai/explain-email-prompt";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let emailBody: unknown;
  try {
    ({ emailBody } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof emailBody !== "string" || emailBody.trim().length < 20) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (emailBody.length > 8000) {
    return NextResponse.json(
      { error: "Email too long — please paste the relevant section only." },
      { status: 400 },
    );
  }

  try {
    const explanation = await callClaude(
      EXPLAIN_EMAIL_SYSTEM_PROMPT,
      buildExplainEmailUserMessage(emailBody),
      1200,
    );
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[agent explain-email] Claude error:", err);
    return NextResponse.json(
      { error: "Sorry, we couldn't process that right now. Please try again in a moment." },
      { status: 500 },
    );
  }
}
