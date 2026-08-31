// GET /api/command/email-templates/resolve?templateKey=&variant=
//
// Returns Sales Progressor's own default for a Tier-2 email (our edited default
// if any, else the built-in code default). Superadmin only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { describePlatformTemplate } from "@/lib/agency-email/templates";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasSuperAdminPowers(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const p = new URL(req.url).searchParams;
  const desc = await describePlatformTemplate(p.get("templateKey") ?? "", p.get("variant") ?? "");
  if (!desc) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  return NextResponse.json(desc);
}
