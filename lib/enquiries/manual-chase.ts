// Shared context + helpers for the human-driven enquiry chase (the send-a-chase
// drawer + its AI "Generate"). Mirrors the auto-chase cron's resolution in
// lib/enquiries/chase.ts so a hand-sent chase is identical to an automatic one
// bar the edits: same recipient (the court's solicitor), same sender identity +
// signature, same tokenised /s/ update link. Used by app/actions/enquiries.ts
// (compose + send) and app/api/ai/generate-enquiry-chase (the draft writer).

import { prisma } from "@/lib/prisma";
import { buildEnquiryChaseEmail } from "@/lib/enquiries/chase-email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { resolveAgentSignatureForFile } from "@/lib/email/agent-signature-for-file";
import { buildInHouseSignoff } from "@/lib/email/in-house-signoff";
import { signSolicitorToken } from "@/lib/solicitor-confirm/token";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { EnquiryCourt } from "@/lib/enquiries/tracker";

export type EnquiryChaseContext = {
  tx: { id: string; propertyAddress: string; agencyId: string | null };
  court: EnquiryCourt;
  seller: boolean;
  solContact: { id: string; email: string | null; name: string | null; secondaryEmail: string | null } | null;
  solFirm: { name: string } | null;
  clients: { contactId: string; name: string; email: string }[];
  clientNames: string[];
  agencyId: string | null;
  ownerId: string | null;
  from: string;
  replyTo?: string;
  senderName: string;
  agencyName: string;
  recipientFirstName?: string;
  chaseCount: number;
  updateUrl: string;
  signatureHtml: string | null;
  signatureText: string | null;
  mail: { subject: string; text: string; html: string };
};

// Resolve everything a manual enquiry chase needs — recipient, CC candidates,
// sender identity + signature, the /s/ update link, and the default (editable)
// draft. Returns null when the loop is gone (closed / no tracker).
export async function resolveEnquiryChaseContext(transactionId: string): Promise<EnquiryChaseContext | null> {
  const tracker = await prisma.enquiryTracker.findUnique({
    where: { transactionId },
    select: {
      currentlyWith: true,
      closedAt: true,
      chaseCount: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          agencyId: true,
          assignedUserId: true,
          agentUserId: true,
          agency: { select: { name: true } },
          vendorSolicitorContact: { select: { id: true, email: true, name: true, secondaryEmail: true } },
          vendorSolicitorFirm: { select: { name: true } },
          purchaserSolicitorContact: { select: { id: true, email: true, name: true, secondaryEmail: true } },
          purchaserSolicitorFirm: { select: { name: true } },
          contacts: { select: { id: true, name: true, email: true, roleType: true } },
        },
      },
    },
  });
  if (!tracker?.transaction) return null;
  const tx = tracker.transaction;
  const court = tracker.currentlyWith as EnquiryCourt;
  const seller = court === "seller_solicitor";
  const side: "vendor" | "purchaser" = seller ? "vendor" : "purchaser";
  const solContact = seller ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  const solFirm = seller ? tx.vendorSolicitorFirm : tx.purchaserSolicitorFirm;

  // Clients on the RECIPIENT's side — the ones we CC by default.
  const clients = tx.contacts
    .filter((c) => c.roleType === (seller ? "vendor" : "purchaser") && !!c.email && !!c.name)
    .map((c) => ({ contactId: c.id, name: c.name as string, email: c.email as string }));
  const clientNames = tx.contacts
    .filter((c) => c.roleType === (seller ? "vendor" : "purchaser"))
    .map((c) => c.name)
    .filter((n): n is string => !!n);

  // Sender identity + signature (mirrors chase.ts).
  const ownerId = tx.assignedUserId ?? tx.agentUserId;
  const { from, replyTo } = await resolveAgencySenderForTransaction(tx.id, { persona: "personal" });
  let senderName = tx.agency?.name ?? "The Sales Progressor";
  const agencyName = tx.agency?.name ?? "The Sales Progressor";
  let ownerAgent: { name: string | null; agencyId: string | null; phone: string | null; directMobile: string | null } | null = null;
  if (ownerId) {
    ownerAgent = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { name: true, agencyId: true, phone: true, directMobile: true },
    });
    if (ownerAgent?.name) senderName = ownerAgent.name;
  }
  const agentSig = await resolveAgentSignatureForFile({
    assignedUserId: tx.assignedUserId,
    agentUserId: tx.agentUserId,
    agentName: senderName,
    agency: tx.agency,
  });
  const inHouseSig = !agentSig && ownerAgent && !ownerAgent.agencyId
    ? buildInHouseSignoff({ name: senderName, agency: tx.agency?.name ?? "", phone: ownerAgent.directMobile ?? ownerAgent.phone ?? null })
    : null;
  const signatureHtml = agentSig?.html ?? inHouseSig?.html ?? null;
  const signatureText = agentSig?.text ?? (inHouseSig ? inHouseSig.text.trim() : null);

  const token = signSolicitorToken(tx.id, side);
  const base = process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
  const updateUrl = `${base}/s/${token}`;
  const recipientFirstName = solContact?.name ? extractFirstName(solContact.name) : undefined;

  const mail = buildEnquiryChaseEmail({
    court,
    address: tx.propertyAddress,
    clientNames,
    recipientFirstName,
    senderName,
    agencyName,
    provideUpdateUrl: updateUrl,
    agentSignatureHtml: signatureHtml,
    agentSignatureText: signatureText,
  });

  return {
    tx: { id: tx.id, propertyAddress: tx.propertyAddress, agencyId: tx.agencyId },
    court,
    seller,
    solContact,
    solFirm,
    clients,
    clientNames,
    agencyId: tx.agencyId,
    ownerId,
    from,
    replyTo,
    senderName,
    agencyName,
    recipientFirstName,
    chaseCount: tracker.chaseCount,
    updateUrl,
    signatureHtml,
    signatureText,
    mail,
  };
}

// Rebuild the sent HTML from the agent's edited plain text: paragraphs become
// <p>, a lone /s/ update link becomes the same dark "Provide an update" button the
// auto-chase uses (any other lone URL becomes a plain link). Keeps a hand-edited
// chase looking like the template even after edits.
export function enquiryChaseTextToHtml(text: string): string {
  const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const WRAP = "font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#111;";
  const BTN = "display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;";
  const paras = text
    .split(/\r?\n\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      if (/^https?:\/\/\S+$/.test(b)) {
        return b.includes("/s/")
          ? `<p><a href="${escH(b)}" style="${BTN}">Provide an update</a></p>`
          : `<p><a href="${escH(b)}" style="color:#2563eb;word-break:break-all;">${escH(b)}</a></p>`;
      }
      return `<p>${b.split(/\r?\n/).map(escH).join("<br>")}</p>`;
    })
    .join("\n");
  return `<div style="${WRAP}">${paras}</div>`;
}
