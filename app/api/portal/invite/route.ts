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
  });

  return NextResponse.json({ ok: true });
}
