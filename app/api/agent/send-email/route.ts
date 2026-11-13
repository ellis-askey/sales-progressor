import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getVerifiedEmailForSending } from "@/lib/services/verified-emails";
import { sendFromVerifiedAddress } from "@/lib/services/sendgrid";
import { resolveSenderForTransaction, buildOutboundMessageId } from "@/lib/email";
import { isEmailThreadingEnabled } from "@/lib/email/threading";
import { randomUUID } from "crypto";
import { resolveEmailSignature } from "@/lib/email/signature";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
import { resolveClientSignoff } from "@/lib/email/client-signoff";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

const AGENCY_SIG_SELECT = { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } as const;

// Wrap the agent's typed body + resolved signature into an HTML part.
function composeHtml(body: string, sigHtml: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = esc(body).replace(/\r?\n/g, "<br>");
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${bodyHtml}${sigHtml}</div>`;
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { fromEmail, to, subject, body, transactionId } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isInternalStaff =
    session.user.role === "sales_progressor" || session.user.role === "admin";

  // ── Internal staff path (SP / admin) ─────────────────────────────────
  if (isInternalStaff) {
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 });
    }

    const scope = getAccessScope(session);
    const tx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { id: true, agencyId: true, agency: { select: AGENCY_SIG_SELECT } },
    });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    // Email threading (Stage 2+): stamp a Message-ID + remember the recipient so
    // an email from this older composer can be continued. Gated on the FILE's
    // agency; off by default → undefined → unchanged behaviour.
    const outboundMessageId = isEmailThreadingEnabled(tx.agencyId)
      ? buildOutboundMessageId(`verified-${randomUUID()}`)
      : undefined;
    const toLower = typeof to === "string" ? [to.toLowerCase()] : [];

    const { from: resolvedFrom, replyTo } = await resolveSenderForTransaction(transactionId, session.user);
    // Outsourced / internal send: a standardised in-house sign-off — never the
    // internal person's customised signature, image, or the agency logo. Signs
    // as name / agency it's sent on behalf of / contact number, matching the
    // automated outsourced chases.
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, directMobile: true },
    });
    const sig = buildInHouseSignoff({
      name: me?.name ?? session.user.name ?? "",
      agency: tx.agency?.name ?? "",
      phone: me?.directMobile ?? me?.phone ?? null,
    });
    const sentHtml = composeHtml(body, sig.html);
    await sendFromVerifiedAddress({ from: resolvedFrom, to, subject, text: body + sig.text, html: sentHtml, replyTo, messageId: outboundMessageId });

    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        subject,
        content: `Email sent to ${to}\n\nSubject: ${subject}\n\n${body}`,
        sentEmailHtml: sentHtml,
        sentFromEmail: resolvedFrom,
        recipientEmail: typeof to === "string" ? to : null,
        createdById: session.user.id,
        visibleToClient: false,
        internetMessageId: outboundMessageId ?? null,
        recipientEmails: toLower,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // ── Agent path (director / negotiator) ───────────────────────────────
  // User explicitly picked fromEmail via the ComposeEmail picker — validate it.
  if (!fromEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const record = await getVerifiedEmailForSending(session.user.id, fromEmail);
  if (!record) {
    return NextResponse.json({ error: "Sending address not found" }, { status: 403 });
  }
  if (record.status !== "verified" && record.status !== "legacy_single_sender") {
    return NextResponse.json(
      { error: `This address can't send right now — it's ${record.status.replace(/_/g, " ")}. Verify it in Settings first.` },
      { status: 403 }
    );
  }
  if (record.status === "verified" && record.verifiedDomain?.status !== "verified") {
    return NextResponse.json(
      { error: "Your domain is no longer authenticated. Please check your DNS settings in Settings." },
      { status: 403 }
    );
  }

  let txForSig: { progressionBusinessId: string | null; agencyId: string | null; agency: { name: string | null } | null } | null = null;
  let agentOutboundMessageId: string | undefined;
  if (transactionId) {
    const scope = getAccessScope(session);
    txForSig = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { progressionBusinessId: true, agencyId: true, agency: { select: { name: true } } },
    });
    if (!txForSig) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    // Email threading (Stage 2+): stamp + remember, gated on the file's agency.
    if (isEmailThreadingEnabled(txForSig.agencyId)) {
      agentOutboundMessageId = buildOutboundMessageId(`verified-${randomUUID()}`);
    }
  }

  // On an external progression business's file, the sign-off follows the sender's
  // PER-CLIENT setting for that client agency (Clients page), falling back to the
  // generic in-house block. On an agency's own file (no progressionBusinessId),
  // the sender's own per-user signature is used, exactly as before.
  let sigHtml: string;
  let sigText: string;
  if (txForSig?.progressionBusinessId) {
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, directMobile: true },
    });
    const cs = await resolveClientSignoff({
      businessId: txForSig.progressionBusinessId,
      agencyId: txForSig.agencyId,
      identity: {
        name: me?.name ?? session.user.name ?? "",
        company: txForSig.agency?.name ?? "",
        phone: me?.directMobile ?? me?.phone ?? null,
      },
    });
    sigHtml = cs.html;
    sigText = cs.text;
  } else {
    const senderAgency = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { agency: { select: AGENCY_SIG_SELECT } },
    });
    const sig = await resolveEmailSignature({
      userId: session.user.id,
      agency: senderAgency?.agency ?? null,
      fallbackName: session.user.name,
    });
    sigHtml = sig.html;
    sigText = sig.text;
  }
  const sentHtml = composeHtml(body, sigHtml);
  const sentFrom = `${session.user.name} <${fromEmail}>`;
  await sendFromVerifiedAddress({
    from: sentFrom,
    to,
    subject,
    text: body + sigText,
    html: sentHtml,
    replyTo: fromEmail,
    messageId: agentOutboundMessageId,
  });

  await prisma.userVerifiedEmail.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  if (transactionId) {
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        subject,
        content: `Email sent to ${to}\n\nSubject: ${subject}\n\n${body}`,
        sentEmailHtml: sentHtml,
        sentFromEmail: sentFrom,
        recipientEmail: typeof to === "string" ? to : null,
        createdById: session.user.id,
        visibleToClient: false,
        internetMessageId: agentOutboundMessageId ?? null,
        recipientEmails: typeof to === "string" ? [to.toLowerCase()] : [],
      },
    });
  }

  return NextResponse.json({ ok: true });
}
