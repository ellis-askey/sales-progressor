import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAuthenticatedDomain } from "@/lib/services/sendgrid";
import { sendEmail } from "@/lib/email";

// Called nightly by Vercel Cron. Protected by CRON_SECRET header.
export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const domains = await prisma.verifiedDomain.findMany({
    where: { status: { in: ["verified", "pending"] } },
    include: {
      userEmails: {
        where: { status: "verified" },
        include: { user: { select: { email: true, name: true } } },
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

      // If a previously working domain has broken, email all affected users
      if (wasValid && !nowValid) {
        const notified = new Set<string>();
        for (const userEmail of domain.userEmails) {
          if (notified.has(userEmail.user.email)) continue;
          notified.add(userEmail.user.email);
          await sendEmail({
            to: userEmail.user.email,
            subject: `Action needed: ${domain.domain} email authentication has broken`,
            text: [
              `Hi ${userEmail.user.name},`,
              ``,
              `The domain authentication for ${domain.domain} is no longer valid.`,
              `This means emails sent from addresses on this domain via Sales Progressor will fail until it's fixed.`,
              ``,
              `This usually happens if the DNS records were removed or changed.`,
              ``,
              `To fix it, go to Settings → Sending addresses and follow the DNS setup instructions again.`,
              ``,
              `Settings: ${process.env.NEXTAUTH_URL}/agent/settings`,
            ].join("\n"),
          }).catch(() => {});
        }
      }

      results.push({ domain: domain.domain, wasValid, nowValid });
    } catch {
      // Don't let one failure stop the others
      results.push({ domain: domain.domain, wasValid: false, nowValid: false });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
