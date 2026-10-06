"use server";

// Builds the pre-filled "email the surveyor" draft (critique #211): addressed to
// the surveyor, the buyer Cc'd, with the access details written straight from the
// file so the agent doesn't have to WhatsApp both sides. Opened in the composer
// for a final read + edit before send or schedule.

import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { extractFirstName } from "@/lib/contacts/displayName";

export type SurveyAccessChoice = "seller" | "keys" | "buyer" | "other";

// Structurally the composer's ComposePrefill — kept here so this server file
// doesn't import from a client component.
export type SurveyEmailDraft = {
  transactionId: string;
  to: string[];
  cc: { email: string; name?: string }[];
  subject: string;
  bodyHtml: string;
};

export type SurveyEmailDraftResult =
  | { ok: true; draft: SurveyEmailDraft; surveyorName: string | null }
  | { ok: false; error: string };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LEVEL_LABEL: Record<string, string> = {
  level_2: "Level 2 (HomeBuyer)",
  level_3: "Level 3 (Building)",
};

export async function buildSurveyorEmailDraft(
  transactionId: string,
  access: SurveyAccessChoice,
  otherNote?: string | null,
): Promise<SurveyEmailDraftResult> {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      activeBuyerRoundId: true,
      bookedSurveyorName: true,
      bookedSurveyorEmail: true,
      surveyLevel: true,
      contacts: { select: { name: true, email: true, phone: true, roleType: true, buyerRoundId: true, isPrincipal: true } },
    },
  });
  if (!tx) return { ok: false, error: "We couldn't find that sale." };

  // Surveyor email: the address captured inline on the survey step, else the
  // booked quote's firm inbox.
  let surveyorEmail = tx.bookedSurveyorEmail?.trim() || null;
  let surveyorName = tx.bookedSurveyorName?.trim() || null;
  if (!surveyorEmail) {
    const booked = await prisma.quoteRequest.findFirst({
      where: { transactionId, status: { in: ["booked", "won"] } },
      orderBy: { bookedAt: "desc" },
      select: { provider: { select: { name: true, email: true } } },
    });
    if (booked?.provider.email) {
      surveyorEmail = booked.provider.email;
      surveyorName = surveyorName ?? booked.provider.name;
    }
  }
  if (!surveyorEmail) return { ok: false, error: "Add the surveyor's email on the survey step first." };

  const sellers = tx.contacts.filter((c) => c.roleType === "vendor" && c.isPrincipal);
  const buyers = tx.contacts.filter((c) => c.roleType === "purchaser" && c.isPrincipal && isActiveRoundContact(c, tx.activeBuyerRoundId));
  const seller = sellers[0] ?? null;
  const buyerWithEmail = buyers.find((b) => b.email) ?? null;
  const anyBuyer = buyerWithEmail ?? buyers[0] ?? null;

  // Survey date from the PM9 completion (resolve the def id first — avoids a
  // relation-name assumption on the completion filter).
  const pm9def = await prisma.milestoneDefinition.findFirst({ where: { code: "PM9" }, select: { id: true } });
  const pm9 = pm9def
    ? await prisma.milestoneCompletion.findFirst({ where: { transactionId, milestoneDefinitionId: pm9def.id }, select: { eventDate: true } })
    : null;
  const dateStr = pm9?.eventDate
    ? new Date(pm9.eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  const address = esc(tx.propertyAddress);
  const levelLabel = tx.surveyLevel ? LEVEL_LABEL[tx.surveyLevel] : null;
  const sellerFirst = seller ? esc(extractFirstName(seller.name)) : null;
  const buyerFirst = anyBuyer ? esc(extractFirstName(anyBuyer.name)) : null;

  let accessLine: string;
  if (access === "keys") {
    accessLine = "Access: please collect the keys from our office. We'll have them ready for you.";
  } else if (access === "buyer") {
    accessLine = buyerFirst
      ? `Access: the buyer, ${buyerFirst}, will be at the property to let you in.${anyBuyer?.phone ? ` Their number is ${esc(anyBuyer.phone)} if you need to coordinate timing.` : ""}`
      : "Access: the buyer will be at the property to let you in.";
  } else if (access === "other") {
    accessLine = otherNote?.trim()
      ? `Access: ${esc(otherNote.trim())}`
      : "Access: we'll confirm the arrangements with you shortly.";
  } else {
    accessLine = sellerFirst
      ? `Access: our seller, ${sellerFirst}, will be at the property to let you in.${seller?.phone ? ` Their number is ${esc(seller.phone)} if you need to coordinate timing.` : ""}`
      : "Access: our seller will be at the property to let you in.";
  }

  const bodyHtml = [
    "<p>Hi there,</p>",
    `<p>Thanks for arranging the ${levelLabel ? `${levelLabel} ` : ""}survey at <strong>${address}</strong>${dateStr ? ` on <strong>${esc(dateStr)}</strong>` : ""}.</p>`,
    `<p>${accessLine}</p>`,
    buyerFirst
      ? `<p>${buyerFirst}, the buyer, is copied in. Any questions, just reply.</p>`
      : "<p>Any questions, just reply.</p>",
  ].join("");

  return {
    ok: true,
    surveyorName,
    draft: {
      transactionId,
      to: [surveyorEmail],
      cc: buyerWithEmail?.email ? [{ email: buyerWithEmail.email, name: buyerWithEmail.name }] : [],
      subject: `Survey access: ${tx.propertyAddress}`,
      bodyHtml,
    },
  };
}
