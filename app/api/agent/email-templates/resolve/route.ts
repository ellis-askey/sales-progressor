// GET /api/agent/email-templates/resolve?templateKey=&variant=
//
// Returns the effective Tier-2 email copy for this agency (their own version if
// any, else our default) + our default for compare/reset. Director only;
// agencyId from the session (Law 7). Generic over the template registry.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { describeTemplate } from "@/lib/agency-email/templates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "director" || !session.user.agencyId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const p = new URL(req.url).searchParams;
  const desc = await describeTemplate(session.user.agencyId, p.get("templateKey") ?? "", p.get("variant") ?? "");
  if (!desc) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(desc);
}
