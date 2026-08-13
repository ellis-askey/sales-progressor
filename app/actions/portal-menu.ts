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

  return {
    contact: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      emailOptedOut: contact.unsubscribedAt !== null,
      image: contact.image,
      roleType: contact.roleType,
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
  };
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
