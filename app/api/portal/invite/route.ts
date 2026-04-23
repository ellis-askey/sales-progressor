import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const contact = await prisma.contact.findUnique({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      roleType: true,
      transaction: {
        select: {
          propertyAddress: true,
          agency: { select: { name: true } },
        },
      },
    },
  });

  if (!contact) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!contact.email) return NextResponse.json({ error: "Contact has no email" }, { status: 400 });

  const saleWord = contact.roleType === "vendor" ? "sale" : "purchase";
  const portalUrl = `${process.env.NEXTAUTH_URL}/portal/${token}`;
  const agencyName = contact.transaction.agency.name;
  const address = contact.transaction.propertyAddress;

  const firstName = contact.name.split(" ")[0];

  await sendEmail({
    to: contact.email,
    subject: `Your ${saleWord} portal — ${address}`,
    text: [
      `Hi ${firstName},`,
      "",
      `You can now track the progress of your ${saleWord} at ${address} using the link below.`,
      "",
      `Your portal: ${portalUrl}`,
      "",
      "This link is personal to you — please don't share it with others.",
      "",
      agencyName,
    ].join("\n"),
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:0;color:#1a1d29;background:#fff">
<div style="background:linear-gradient(135deg,#FF8A65 0%,#FFB74D 100%);padding:40px 32px 32px;border-radius:0 0 24px 24px">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75)">${agencyName}</p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#fff;line-height:1.2">${address}</h1>
  <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85)">Your ${saleWord} portal is ready</p>
</div>
<div style="padding:32px">
  <p style="margin:0 0 16px;font-size:15px">Hi ${firstName},</p>
  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4a5162">
    You can now track the progress of your ${saleWord} online. Check in any time to see what's been completed, what's coming next, and get updates from your team.
  </p>
  <p style="margin:0 0 32px">
    <a href="${portalUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 16px rgba(255,107,74,0.35)">
      Open my portal
    </a>
  </p>
  <div style="padding:14px 16px;background:#F8F9FB;border-radius:10px;margin-bottom:24px">
    <p style="margin:0;font-size:12px;color:#8b91a3">
      This link is personal to you — please don't share it with others. You can bookmark it and return any time.
    </p>
  </div>
  <p style="margin:0;font-size:12px;color:#8b91a3">${agencyName}</p>
</div>
</body></html>`,
  });

  return NextResponse.json({ ok: true });
}
