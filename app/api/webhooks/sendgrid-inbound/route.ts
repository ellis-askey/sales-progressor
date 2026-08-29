// POST /api/webhooks/sendgrid-inbound
//
// SendGrid Inbound Parse receiver for PROSPECT replies. Outreach emails set a
// Reply-To of reply+<replyToken>@<inbound domain>; a reply routes here, we match
// the token to the ProspectEmail and stamp the reply on the email + prospect,
// and log an "email_received" activity so it shows on the prospect timeline.
//
// Setup (Ellis, during the build): SendGrid → Settings → Inbound Parse → add the
// host (e.g. reply.thesalesprogressor.co.uk) with the POST URL pointing here, and
// set that subdomain's MX record to mx.sendgrid.net. The replyToken (32 hex
// chars) is unguessable, which is the auth on this endpoint.

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }

  const to = String(form.get("to") ?? "");
  const bodyText = String(form.get("text") ?? form.get("html") ?? "");
  const match = to.match(/reply\+([a-z0-9]+)@/i);
  const token = match?.[1] ?? null;
  if (!token) return NextResponse.json({ ok: true, matched: false });

  const email = await prisma.prospectEmail.findUnique({
    where: { replyToken: token },
    select: { id: true, prospectId: true },
  });
  if (!email) return NextResponse.json({ ok: true, matched: false });

  const now = new Date();
  await prisma.prospectEmail.updateMany({ where: { id: email.id, repliedAt: null }, data: { repliedAt: now } });

  // A reply is a strong positive — advance an early-stage prospect to "replied".
  const prospect = await prisma.prospect.findUnique({ where: { id: email.prospectId }, select: { status: true } });
  if (prospect && (prospect.status === "new" || prospect.status === "contacted")) {
    await prisma.prospect.update({ where: { id: email.prospectId }, data: { status: "replied" } }).catch(() => {});
  }

  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 400);
  await prisma.prospectActivity.create({
    data: { prospectId: email.prospectId, type: "email_received", summary: "Reply received", body: snippet || null },
  }).catch(() => {});

  return NextResponse.json({ ok: true, matched: true });
}
