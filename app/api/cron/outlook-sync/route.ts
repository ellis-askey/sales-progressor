import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { syncOutlookMailbox } from "@/lib/integrations/outlook/sync";

// Tier 3, Stage 1 — automatic capture. Runs the existing Outlook sync on a
// schedule for every connected mailbox, so replies land on the right file by
// themselves instead of only on a manual "Sync now" click. It ONLY files
// emails as inbound activity (via the unchanged syncOutlookMailbox); it does
// not read, interpret, or act on them. No-op until mailboxes are connected.
//
// syncOutlookMailbox scopes its file-matching to the connection owner's access
// scope, so per connection we present that owner as the session.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.outlookConnection.findMany({
    select: {
      id: true, email: true, accessToken: true, refreshToken: true, tokenExpiresAt: true, scope: true,
      user: { select: { id: true, role: true, agencyId: true, email: true } },
    },
  });

  let mailboxes = 0;
  let logged = 0;
  let unmatched = 0;
  for (const conn of connections) {
    // Minimal session standing in for the connection owner — getAccessScope /
    // hasAdminPowers only read user.{id, role, agencyId, email}.
    const session = {
      user: { id: conn.user.id, role: conn.user.role, agencyId: conn.user.agencyId ?? "", email: conn.user.email },
    } as unknown as Session;
    try {
      const summary = await syncOutlookMailbox(
        { id: conn.id, email: conn.email, accessToken: conn.accessToken, refreshToken: conn.refreshToken, tokenExpiresAt: conn.tokenExpiresAt, scope: conn.scope },
        session,
      );
      mailboxes++;
      logged += summary.logged.length;
      unmatched += summary.unmatched.length;
    } catch (err) {
      console.error(`[outlook-sync cron] failed for ${conn.email}:`, (err as Error).message);
    }
  }

  return NextResponse.json({ mailboxes, logged, unmatched });
}
