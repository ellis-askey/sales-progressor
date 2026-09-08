import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAuthenticatedDomain, listVerifiedSingleSenders } from "@/lib/services/sendgrid";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildDomainAuth } from "@/lib/emails/domain-auth";
import { extractFirstName } from "@/lib/contacts/displayName";
import { adoptVerifiedDomainAsAgencySender } from "@/lib/services/verified-emails";
import { runJob } from "@/lib/cron/run-job";

// Called nightly by Vercel Cron. Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runJob("check-domains", async () => {
  const domains = await prisma.verifiedDomain.findMany({
    where: { status: { in: ["verified", "pending"] } },
    include: {
      userEmails: {
        where: { status: "verified" },
        include: { user: { select: { id: true, email: true, name: true } } },
      },
    },
  });

  const results: { domain: string; wasValid: boolean; nowValid: boolean }[] = [];

  for (const domain of domains) {
    try {
      const result = await validateAuthenticatedDomain(domain.sendgridDomainId);
      const wasValid = domain.status === "verified";
      const nowValid = result.valid;

      await prisma.verifiedDomain.update({
        where: { id: domain.id },
        data: {
          dkimValid: result.dkimValid,
          spfValid: result.spfValid,
          status: nowValid ? "verified" : "pending",
          verifiedAt: nowValid && !wasValid ? new Date() : domain.verifiedAt,
          lastCheckedAt: new Date(),
        },
      });

      // Newly verified → adopt as the agency's sending address (if none yet).
      if (nowValid && domain.agencyId) {
        await adoptVerifiedDomainAsAgencySender(domain.agencyId, domain.domain);
      }

      // If a previously working domain has broken, email all affected users
      if (wasValid && !nowValid) {
        const notified = new Set<string>();
        for (const userEmail of domain.userEmails) {
          if (notified.has(userEmail.user.email)) continue;
          notified.add(userEmail.user.email);
          const built = buildDomainAuth({
            firstName: userEmail.user.name?.trim() ? extractFirstName(userEmail.user.name) : "there",
            domain: domain.domain,
            fixUrl: `${process.env.NEXTAUTH_URL}/agent/account/profile`,
          });
          await sendAgentEmail({
            to: userEmail.user.email,
            kind: "domain_auth",
            userId: userEmail.user.id,
            agencyId: domain.agencyId,
            meta: { domain: domain.domain },
            subject: built.subject,
            text: built.text,
            html: built.html,
            replyTo: "support@thesalesprogressor.co.uk",
          }).catch(() => {});
        }
      }

      results.push({ domain: domain.domain, wasValid, nowValid });
    } catch {
      // Don't let one failure stop the others
      results.push({ domain: domain.domain, wasValid: false, nowValid: false });
    }
  }

  // ── Stamp each agency's quoteSenderVerified so the sender resolver never
  // sends from an unverified address. Sendable = its domain is authenticated
  // (a verified VerifiedDomain) OR it's a verified single sender in SendGrid.
  let senderStamped = 0;
  const singleSenders = await listVerifiedSingleSenders();
  const singleSenderFetchOk = singleSenders.size > 0;
  const verifiedDomainNames = new Set(
    (await prisma.verifiedDomain.findMany({ where: { status: "verified" }, select: { domain: true } }))
      .map((d) => d.domain.toLowerCase()),
  );
  const senderAgencies = await prisma.agency.findMany({
    where: { quoteSenderEmail: { not: null } },
    select: { id: true, quoteSenderEmail: true, quoteSenderVerified: true },
  });
  for (const a of senderAgencies) {
    const email = a.quoteSenderEmail!.toLowerCase();
    const domain = email.split("@")[1];
    const domainAuthed = domain ? verifiedDomainNames.has(domain) : false;
    const sendable = domainAuthed || singleSenders.has(email);
    // If the single-sender list failed to load, don't downgrade a
    // previously-verified sender we can't re-confirm this run.
    if (!sendable && !singleSenderFetchOk && a.quoteSenderVerified && !domainAuthed) continue;
    if (sendable !== a.quoteSenderVerified) {
      await prisma.agency.update({
        where: { id: a.id },
        data: { quoteSenderVerified: sendable, quoteSenderVerifiedAt: sendable ? new Date() : null },
      });
      senderStamped++;
    }
  }

  return NextResponse.json({ checked: results.length, results, senderStamped });
  });
}
