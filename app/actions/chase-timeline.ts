"use server";

// Chase-timeline edit/skip actions (chase-consolidation D2/D3). The agent
// edits or skips a thread's UPCOMING chase from the timeline; these write the
// ChaseEmailOverride the cron builds read at fire time. previewChaseEmailAction
// generates the copy that WOULD send (so the editor shows the real email to
// tweak). All scope-gated to the file's owner. See docs/active/chase-consolidation.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { setChaseOverride, clearChaseOverride } from "@/lib/services/chase-overrides";
import { assembleDigestPayload } from "@/lib/email/client-chase-digest";
import { resolveClientChaseContent } from "@/lib/agency-email/templates";
import { buildSolicitorDigestEmail } from "@/lib/solicitor-confirm/digest-email";
import { solicitorStepLabel } from "@/lib/solicitor-confirm/codes";
import { getMilestoneCopy } from "@/lib/portal-copy";

type TargetInput =
  | { kind: "client"; contactId: string }
  | { kind: "solicitor"; side: "vendor" | "purchaser" };

async function assertOwns(transactionId: string) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");
  return session;
}

function revalidate(transactionId: string) {
  revalidatePath(`/agent/transactions/${transactionId}`, "page");
}

// Stage a subject/body edit for the next chase (blank clears that edit).
export async function editChaseThreadAction(input: {
  transactionId: string;
  target: TargetInput;
  milestoneCode: string;
  subject: string;
  body: string;
}): Promise<{ ok: true }> {
  const session = await assertOwns(input.transactionId);
  await setChaseOverride({
    transactionId: input.transactionId,
    target: input.target,
    milestoneCode: input.milestoneCode,
    subjectOverride: input.subject.trim() || null,
    bodyOverride: input.body.trim() || null,
    editedById: session.user.id,
  });
  revalidate(input.transactionId);
  return { ok: true };
}

// Toggle "skip the next chase" for this thread (skip-semantics A).
export async function skipChaseThreadAction(input: {
  transactionId: string;
  target: TargetInput;
  milestoneCode: string;
  skip: boolean;
}): Promise<{ ok: true }> {
  const session = await assertOwns(input.transactionId);
  await setChaseOverride({
    transactionId: input.transactionId,
    target: input.target,
    milestoneCode: input.milestoneCode,
    skipNext: input.skip,
    editedById: session.user.id,
  });
  revalidate(input.transactionId);
  return { ok: true };
}

// Remove any edit/skip — revert the next chase to the standard copy + cadence.
export async function clearChaseThreadAction(input: {
  transactionId: string;
  target: TargetInput;
  milestoneCode: string;
}): Promise<{ ok: true }> {
  await assertOwns(input.transactionId);
  await clearChaseOverride(input.transactionId, input.target, input.milestoneCode);
  revalidate(input.transactionId);
  return { ok: true };
}

// Generate the copy the next chase WOULD send, so the editor can show + tweak
// it. Returns the staged override if one exists, else the freshly-generated
// default. Links in the preview are placeholders (the agent edits text).
export async function previewChaseEmailAction(input: {
  transactionId: string;
  target: TargetInput;
  milestoneCode: string;
}): Promise<{ ok: true; subject: string; text: string } | { ok: false; error: string }> {
  await assertOwns(input.transactionId);
  const target = input.target; // local const so the discriminated union narrows into closures

  // If the agent already staged an edit, prefill with that.
  const targetKey = target.kind === "client" ? `contact:${target.contactId}` : `sol:${target.side}`;
  const existing = await prisma.chaseEmailOverride.findUnique({
    where: {
      transactionId_targetKey_milestoneCode: {
        transactionId: input.transactionId, targetKey, milestoneCode: input.milestoneCode,
      },
    },
    select: { subjectOverride: true, bodyOverride: true },
  });

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: input.transactionId },
    select: {
      propertyAddress: true, purchasePrice: true, agencyId: true,
      agency: { select: { name: true } },
      agentUser: { select: { name: true, phone: true } },
      assignedUser: { select: { name: true, phone: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      contacts: { select: { id: true, name: true, portalToken: true, roleType: true } },
    },
  });
  if (!tx) return { ok: false, error: "Transaction not found" };
  const brand = tx.agency?.name ?? "Sales Progressor";

  if (target.kind === "client") {
    const c = tx.contacts.find((x) => x.id === target.contactId);
    if (!c) return { ok: false, error: "Contact not found" };
    const agencyCopy = await resolveClientChaseContent(tx.agencyId);
    const payload = assembleDigestPayload({
      transaction: { id: input.transactionId, propertyAddress: tx.propertyAddress },
      contact: { id: c.id, name: c.name, portalToken: c.portalToken ?? "preview" },
      milestones: [{ code: input.milestoneCode }],
      agencyName: brand,
      recipientSide: c.roleType === "purchaser" ? "purchaser" : "vendor",
      agencyCopy,
    });
    return {
      ok: true,
      subject: existing?.subjectOverride ?? payload.subject,
      text: existing?.bodyOverride ?? payload.text,
    };
  }

  // Solicitor preview.
  const side = target.side;
  const sellerNames = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name).join(" & ") || "the seller";
  const buyerNames = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name).join(" & ") || "the buyer";
  const firmName = side === "vendor" ? tx.vendorSolicitorFirm?.name ?? null : tx.purchaserSolicitorFirm?.name ?? null;
  const person = tx.assignedUser ?? tx.agentUser;
  const label = solicitorStepLabel(input.milestoneCode, getMilestoneCopy(input.milestoneCode).label);
  const built = buildSolicitorDigestEmail({
    brand, address: tx.propertyAddress, pricePence: tx.purchasePrice,
    sellerNames, buyerNames, side, firmName,
    ownClientNames: (side === "vendor" ? sellerNames : buyerNames) || tx.propertyAddress,
    steps: [{ label }],
    confirmUrl: "#", stopUrl: "#", qrUrl: "#",
    personName: person?.name ?? brand, personPhone: person?.phone ?? null, avatarUrl: null,
  });
  return {
    ok: true,
    subject: existing?.subjectOverride ?? built.subject,
    text: existing?.bodyOverride ?? built.text,
  };
}
