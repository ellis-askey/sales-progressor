"use server";

// Portal menu drawer — server actions for the four sections Ellis
// approved. All gated on the portal token (no NextAuth session; the
// client is anonymous). Every mutation logs an `internal_note` on the
// transaction so the agent sees exactly what changed via their existing
// comms feed.
//
// Solicitor edits use COPY-ON-WRITE (never mutate the shared
// SolicitorFirm / SolicitorContact rows because they're referenced by
// other agencies' files). "Update details" clones the SolicitorContact;
// "Switch firm" upserts a SolicitorFirm by name + creates a fresh
// SolicitorContact + swaps the tx's FK.
//
// 2026-08-09.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createChainV2, addChainLink, updateChainLinkStub, getChainForTransactionV2 } from "@/lib/services/chains";
import { createNotification } from "@/lib/services/notifications";
import { getPortalChainAgent, getPortalSurveyState, type PortalChainAgent } from "@/lib/services/portal";
import { pauseContactChases, resumeContactChases } from "@/lib/services/chase-pause";

// ── Token → Contact resolver (single source of truth) ────────────────
async function requirePortalContact(token: string) {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token");
  }
  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roleType: true,
      propertyTransactionId: true,
      unsubscribedAt: true,
      image: true,
      chasesPausedUntil: true,
    },
  });
  if (!contact) throw new Error("Invalid token");
  return contact;
}

// ── Read: everything the drawer needs on open ────────────────────────
export type MyPortalDetails = {
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    emailOptedOut: boolean;
    image: string | null;
    roleType: string;
    chasesPausedUntil: string | null;
  };
  propertyAddress: string;
  solicitor: {
    firmId: string;
    firmName: string;
    contactId: string | null;
    contactName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  chainAgent: PortalChainAgent;
  survey: {
    applicable: boolean;
    skipped: boolean;
    definitionId: string | null;
    canReenable: boolean;
    progressorName: string | null;
    progressorEmail: string | null;
  };
};

export async function getMyPortalDetailsAction(token: string): Promise<MyPortalDetails> {
  const contact = await requirePortalContact(token);
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: {
      vendorSolicitorFirmId:       true,
      vendorSolicitorContactId:    true,
      purchaserSolicitorFirmId:    true,
      purchaserSolicitorContactId: true,
      vendorSolicitorFirm:      { select: { id: true, name: true } },
      vendorSolicitorContact:   { select: { id: true, name: true, email: true, phone: true } },
      purchaserSolicitorFirm:   { select: { id: true, name: true } },
      purchaserSolicitorContact:{ select: { id: true, name: true, email: true, phone: true } },
      propertyAddress:          true,
    },
  });
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const firm    = side === "vendor" ? tx?.vendorSolicitorFirm    : tx?.purchaserSolicitorFirm;
  const solCtc  = side === "vendor" ? tx?.vendorSolicitorContact : tx?.purchaserSolicitorContact;
  const chainAgent = await getPortalChainAgent(contact.propertyTransactionId, side);
  const survey = await getPortalSurveyState(token);

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      emailOptedOut: contact.unsubscribedAt !== null,
      image: contact.image,
      roleType: contact.roleType,
      chasesPausedUntil: contact.chasesPausedUntil?.toISOString() ?? null,
    },
    propertyAddress: tx?.propertyAddress ?? "",
    solicitor: firm
      ? {
          firmId: firm.id,
          firmName: firm.name,
          contactId: solCtc?.id ?? null,
          contactName: solCtc?.name ?? null,
          email: solCtc?.email ?? null,
          phone: solCtc?.phone ?? null,
        }
      : null,
    chainAgent,
    survey,
  };
}

// ── Write 5: my neighbouring chain agent (audit #16 phase 3) ─────────────
// A buyer records their SELLING agent; a seller records their ONWARD-PURCHASE
// agent. Pre-filled from the stub the managing agent entered. If no chain
// exists yet, this creates one; if the neighbour stub exists, it's updated; if
// the agent has already joined, it's read-only and this refuses. NO invite is
// sent — the managing agent is notified (Updates feed + a bell notification)
// and decides whether to invite. All chain writes are attributed to the
// managing user (the client is a Contact, not a User).
export async function updateMyChainAgentAction(input: {
  token: string;
  agentName: string | null;
  agencyName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  propertyAddress: string | null;
}) {
  const contact = await requirePortalContact(input.token);
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const direction: "above" | "below" = side === "vendor" ? "above" : "below";

  const agentName  = input.agentName?.trim() || null;
  const agencyName = input.agencyName?.trim() || null;
  const agentEmail = input.agentEmail?.trim() || null;
  const agentPhone = input.agentPhone?.trim() || null;
  const propertyAddress = input.propertyAddress?.trim() || "";

  if (!agentName && !agencyName) {
    return { ok: false as const, error: "Add at least the agent's name or their agency." };
  }

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: { serviceType: true, assignedUserId: true, agentUserId: true, agencyId: true },
  });
  const managingUserId = tx
    ? (tx.serviceType !== "self_managed" ? tx.assignedUserId : tx.agentUserId)
    : null;
  if (!tx || !managingUserId || !tx.agencyId) {
    return { ok: false as const, error: "We can't update the chain on this file yet. Your agent can add it for you." };
  }

  const stub = {
    stubPropertyAddress: propertyAddress,
    stubAgencyName: agencyName ?? "",
    stubAgentName: agentName,
    stubAgentEmail: agentEmail,
    stubAgentPhone: agentPhone,
  };

  const chain = await getChainForTransactionV2(contact.propertyTransactionId).catch(() => null);
  if (!chain) {
    await createChainV2({
      transactionId: contact.propertyTransactionId,
      agencyId: tx.agencyId,
      userId: managingUserId,
      stubs: [{ direction, ...stub }],
    });
  } else {
    const own = chain.links.find((l) => l.transactionId === contact.propertyTransactionId);
    const targetPos = own ? (direction === "above" ? own.position - 1 : own.position + 1) : null;
    const neighbour = targetPos != null ? chain.links.find((l) => l.position === targetPos) : null;
    if (neighbour && neighbour.transactionId !== null) {
      return { ok: false as const, error: "That agent has already joined, so their details can't be changed here." };
    }
    if (neighbour) {
      await updateChainLinkStub(neighbour.id, {
        stubPropertyAddress: propertyAddress || undefined,
        stubAgencyName: stub.stubAgencyName,
        stubAgentName: agentName,
        stubAgentEmail: agentEmail,
        stubAgentPhone: agentPhone,
      });
    } else {
      await addChainLink({ chainId: chain.id, userId: managingUserId, direction, ...stub });
    }
  }

  // Notify the managing agent — Updates feed (internal note) + a bell
  // notification (the first non-confirmation event surfaced in the bell).
  const sideWord = side === "vendor" ? "onward-purchase" : "selling";
  const who = agentName ?? agencyName ?? "their agent";
  const at = agentName && agencyName ? ` at ${agencyName}` : "";
  const body = `${contact.name} added their ${sideWord} agent via the portal: ${who}${at}.`;
  await prisma.outboundMessage.create({
    data: { transactionId: contact.propertyTransactionId, type: "internal_note", contactIds: [], content: body },
  });
  await createNotification({
    userId: managingUserId,
    type: "portal_chain_agent_updated",
    transactionId: contact.propertyTransactionId,
    payload: { title: "Chain agent added", body, contactName: contact.name },
  });

  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const };
}

// ── Write 1: my own contact details ──────────────────────────────────
export async function updateMyContactAction(input: {
  token: string;
  name: string;
  email: string | null;
  phone: string | null;
}) {
  const contact = await requirePortalContact(input.token);
  const cleanName  = input.name.trim();
  const cleanEmail = input.email?.trim() || null;
  const cleanPhone = input.phone?.trim() || null;
  if (!cleanName) return { ok: false as const, error: "Name can't be empty" };

  // Diff so the note is specific instead of generic.
  const diffs: string[] = [];
  if (cleanName  !== contact.name)  diffs.push(`name (${contact.name} → ${cleanName})`);
  if (cleanEmail !== contact.email) diffs.push(`email (${contact.email ?? "empty"} → ${cleanEmail ?? "empty"})`);
  if (cleanPhone !== contact.phone) diffs.push(`phone (${contact.phone ?? "empty"} → ${cleanPhone ?? "empty"})`);
  if (diffs.length === 0) return { ok: true as const, changed: false };

  await prisma.contact.update({
    where: { id: contact.id },
    data: { name: cleanName, email: cleanEmail, phone: cleanPhone },
  });
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} updated their own details via the portal: ${diffs.join(", ")}.`,
    },
  });

  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const, changed: true };
}

// ── Write 2: my solicitor's contact details (copy-on-write) ─────────
// For "case handler moved", "wrong email", or "agent-side typo". The
// firm stays; the contact row is cloned so no other file is affected.
export async function updateMySolicitorContactAction(input: {
  token: string;
  name: string;
  email: string | null;
  phone: string | null;
}) {
  const contact = await requirePortalContact(input.token);
  const cleanName  = input.name.trim();
  const cleanEmail = input.email?.trim() || null;
  const cleanPhone = input.phone?.trim() || null;
  if (!cleanName) return { ok: false as const, error: "Contact name can't be empty" };

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: contact.propertyTransactionId },
    select: {
      vendorSolicitorFirmId:       true,
      vendorSolicitorContactId:    true,
      purchaserSolicitorFirmId:    true,
      purchaserSolicitorContactId: true,
    },
  });
  if (!tx) return { ok: false as const, error: "Transaction not found" };
  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const firmId = side === "vendor" ? tx.vendorSolicitorFirmId : tx.purchaserSolicitorFirmId;
  if (!firmId) {
    return { ok: false as const, error: "No solicitor firm set yet. Use \"Switch to a different firm\" instead." };
  }

  // Copy-on-write: new SolicitorContact under the same firm.
  const created = await prisma.solicitorContact.create({
    data: { firmId, name: cleanName, email: cleanEmail, phone: cleanPhone },
  });
  await prisma.propertyTransaction.update({
    where: { id: contact.propertyTransactionId },
    data: side === "vendor"
      ? { vendorSolicitorContactId: created.id }
      : { purchaserSolicitorContactId: created.id },
  });

  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} updated their solicitor's details via the portal (new handler / details): ${cleanName}${cleanEmail ? ` · ${cleanEmail}` : ""}${cleanPhone ? ` · ${cleanPhone}` : ""}. Original firm record kept for other files.`,
    },
  });

  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const };
}

// ── Write 3: switch to a different firm entirely ────────────────────
// For real firm changes (client moved practices). Upserts the
// SolicitorFirm by name (unique) so we don't duplicate an existing one;
// always creates a fresh SolicitorContact.
export async function switchMySolicitorFirmAction(input: {
  token: string;
  firmName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
}) {
  const contact = await requirePortalContact(input.token);
  const cleanFirm    = input.firmName.trim();
  const cleanContact = input.contactName.trim();
  const cleanEmail   = input.email?.trim() || null;
  const cleanPhone   = input.phone?.trim() || null;
  if (!cleanFirm)    return { ok: false as const, error: "Firm name can't be empty" };
  if (!cleanContact) return { ok: false as const, error: "Case handler name can't be empty" };

  // upsert by unique(name) so we reuse an existing firm if it's already
  // in the system — avoids duplicate SolicitorFirm rows for the same
  // real-world practice.
  const firm = await prisma.solicitorFirm.upsert({
    where: { name: cleanFirm },
    update: {},
    create: { name: cleanFirm },
  });
  const created = await prisma.solicitorContact.create({
    data: { firmId: firm.id, name: cleanContact, email: cleanEmail, phone: cleanPhone },
  });

  const side = contact.roleType === "vendor" ? "vendor" : "purchaser";
  await prisma.propertyTransaction.update({
    where: { id: contact.propertyTransactionId },
    data: side === "vendor"
      ? { vendorSolicitorFirmId: firm.id, vendorSolicitorContactId: created.id }
      : { purchaserSolicitorFirmId: firm.id, purchaserSolicitorContactId: created.id },
  });

  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} switched their solicitor firm via the portal: ${cleanFirm} · ${cleanContact}${cleanEmail ? ` · ${cleanEmail}` : ""}${cleanPhone ? ` · ${cleanPhone}` : ""}. Previous firm record kept for other files.`,
    },
  });

  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const };
}

// ── Write 4: notification preferences ────────────────────────────────
export async function updateMyNotificationsAction(input: {
  token: string;
  emailOptedOut: boolean;
}) {
  const contact = await requirePortalContact(input.token);
  const currentlyOptedOut = contact.unsubscribedAt !== null;
  if (currentlyOptedOut === input.emailOptedOut) return { ok: true as const, changed: false };

  await prisma.contact.update({
    where: { id: contact.id },
    data: { unsubscribedAt: input.emailOptedOut ? new Date() : null },
  });
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} ${input.emailOptedOut ? "opted OUT of" : "opted back INTO"} automated update emails via the portal.`,
    },
  });

  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const, changed: true };
}

// ── Write 6: pause / resume my chase reminders (audit #11 / #15) ─────────
// The portal-side door to the same timed pause the chase-email link uses.
// 1 or 2 weeks; the shared helper logs a note + notifies the agent (bell).
export async function pauseMyChasesAction(input: { token: string; weeks: number }) {
  const contact = await requirePortalContact(input.token);
  const weeks = input.weeks === 2 ? 2 : 1;
  const until = new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000);
  await pauseContactChases(contact.id, until, "portal");
  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const, until: until.toISOString() };
}

export async function resumeMyChasesAction(input: { token: string }) {
  const contact = await requirePortalContact(input.token);
  await resumeContactChases(contact.id);
  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "internal_note",
      contactIds: [],
      content: `${contact.name} turned their chase reminders back on via the portal.`,
    },
  }).catch(() => {});
  revalidatePath(`/portal/${input.token}`, "layout");
  return { ok: true as const };
}
