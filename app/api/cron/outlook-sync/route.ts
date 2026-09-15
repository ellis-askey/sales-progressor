import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { syncOutlookMailbox } from "@/lib/integrations/outlook/sync";
import { syncImapMailbox } from "@/lib/integrations/imap/sync";
import { interpretNewInboundEmails } from "@/lib/services/email-interpret";
import { runJob } from "@/lib/cron/run-job";

// Tier 3, Stage 1 — automatic capture. Runs every connected mailbox on a
// schedule (Outlook AND IMAP: Gmail, Yahoo, custom domains), so replies land on
// the right file by themselves instead of only on a manual "Check now" click.
// Both providers file emails as inbound activity through the same shared engine;
// the Stage 2 interpret step then runs once over everything captured. No-op until
// mailboxes are connected.
//
// Each sync scopes its file-matching to the connection owner's access scope, so
// per connection we present that owner as the session.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("outlook-sync", async () => {
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

  // IMAP mailboxes (Gmail via app-password, Yahoo, custom domains, etc.) through
  // the same shared engine. Owner-scoped exactly like Outlook above.
  const imapConns = await prisma.imapConnection.findMany({
    select: {
      id: true, email: true, provider: true, host: true, port: true, secure: true, encryptedPassword: true,
      user: { select: { id: true, role: true, agencyId: true, email: true } },
    },
  });
  for (const conn of imapConns) {
    const session = {
      user: { id: conn.user.id, role: conn.user.role, agencyId: conn.user.agencyId ?? "", email: conn.user.email },
    } as unknown as Session;
    try {
      const summary = await syncImapMailbox(
        { id: conn.id, email: conn.email, provider: conn.provider, host: conn.host, port: conn.port, secure: conn.secure, encryptedPassword: conn.encryptedPassword },
        session,
      );
      mailboxes++;
      logged += summary.logged.length;
      unmatched += summary.unmatched.length;
    } catch (err) {
      console.error(`[imap-sync cron] failed for ${conn.email}:`, (err as Error).message);
    }
  }

  // Stage 2: read the newly-captured emails (from every provider) and turn the
  // meaningful ones into proposals for human review. Never acts — only writes
  // MilestoneProposal rows.
  const interp = await interpretNewInboundEmails(30).catch(() => ({ interpreted: 0, proposed: 0 }));

  return NextResponse.json({ mailboxes, logged, unmatched, interpreted: interp.interpreted, proposed: interp.proposed });
  });
}
