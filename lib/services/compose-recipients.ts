// Recipient model for the agent email composer (critique 2026-10-05).
//
// Resolves, for one sale, everyone the agent could email: the clients
// (seller / buyer / broker, from Contact rows), both solicitors (from the
// side-tagged SolicitorContact FKs, incl. their assistant secondaryEmail), and
// the agent's own team (agency colleagues with a login email). Reuses the chase
// recipient helpers so solicitor labelling/side matches the chase drawer.
//
// Server-only: it reads the DB scoped to the caller. The returned ComposeRecipient
// shape is client-safe (plain data) and feeds ComposeEmailModal.

import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveSenderForTransaction } from "@/lib/email";
import { solicitorToRecipient, recipientRoleLabel, type ChaseContact } from "@/lib/services/chase-recipients";

export type ComposeRecipientKind = "vendor" | "purchaser" | "broker" | "solicitor" | "team" | "agent";

export interface ComposeRecipient {
  id: string;            // contact id / solicitor contact id / user id
  name: string;
  email: string;
  roleLabel: string;     // "Seller", "Buyer's solicitor (Firm)", "Your team", …
  kind: ComposeRecipientKind;
  side: "vendor" | "purchaser" | null; // for solicitor avatar tinting
  group: "sale" | "team";
  avatarUrl: string | null; // photo/headshot when on file, else null (branded art)
  // Solicitor assistant/secretary — auto-suggested as a Cc, like the chase flow.
  secondaryEmail?: string | null;
}

export interface ComposeSale {
  id: string;
  address: string;
  line1: string;         // street line
  location: string;      // town + postcode
  photoPath: string | null;
}

export interface ComposeContext {
  sale: ComposeSale;
  recipients: ComposeRecipient[];
  fromEmail: string;     // resolved sending identity (display form "Name <email>")
}

const CLIENT_ROLES = new Set(["vendor", "purchaser", "broker"]);

export function splitComposeAddress(address: string): { line1: string; location: string } {
  const parts = address.split(",");
  const line1 = (parts[0] ?? address).trim();
  const location = parts.slice(1).join(",").trim();
  return { line1, location: location || line1 };
}

function clientRoleLabel(roleType: string): string {
  if (roleType === "vendor") return "Seller";
  if (roleType === "purchaser") return "Buyer";
  if (roleType === "broker") return "Mortgage broker";
  return roleType.charAt(0).toUpperCase() + roleType.slice(1);
}

function solicitorRecipient(sol: Parameters<typeof solicitorToRecipient>[0], side: "vendor" | "purchaser"): ComposeRecipient | null {
  const r: ChaseContact | null = solicitorToRecipient(sol, side);
  if (!r || !r.email) return null;
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    roleLabel: recipientRoleLabel(r),
    kind: "solicitor",
    side,
    group: "sale",
    avatarUrl: null,
    secondaryEmail: r.secondaryEmail ?? null,
  };
}

// Resolve the full compose context for one sale, scoped to the caller. Returns
// null when the sale isn't in the caller's scope (tenant-safe).
export async function getComposeContext(
  transactionId: string,
  session: Session,
): Promise<ComposeContext | null> {
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      id: true,
      propertyAddress: true,
      photoStoragePath: true,
      agencyId: true,
      // The overseeing/submitting agent on an outsourced file (the customer-
      // agency agent). Emailable by internal staff / external progressors.
      agentUser: { select: { id: true, name: true, email: true, image: true } },
      contacts: {
        where: { email: { not: null } },
        select: { id: true, name: true, email: true, roleType: true },
      },
      vendorSolicitorContact: { select: { id: true, name: true, email: true, phone: true, secondaryEmail: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorContact: { select: { id: true, name: true, email: true, phone: true, secondaryEmail: true } },
      purchaserSolicitorFirm: { select: { name: true } },
    },
  });
  if (!tx) return null;

  const recipients: ComposeRecipient[] = [];

  // Clients (seller / buyer / broker).
  for (const c of tx.contacts) {
    if (!c.email || !CLIENT_ROLES.has(c.roleType)) continue;
    recipients.push({
      id: c.id,
      name: c.name,
      email: c.email,
      roleLabel: clientRoleLabel(c.roleType),
      kind: c.roleType as ComposeRecipientKind,
      // Broker is the buyer's mortgage broker, so it belongs to the purchaser
      // side for the "one side at a time" rule.
      side: c.roleType === "vendor" ? "vendor" : c.roleType === "purchaser" || c.roleType === "broker" ? "purchaser" : null,
      group: "sale",
      avatarUrl: null,
    });
  }

  // The overseeing agent (outsourced files) — side-less, like the team, so it
  // never locks a side. Hidden when the viewer IS that agent (own file).
  if (tx.agentUser?.email && tx.agentUser.id !== session.user.id) {
    recipients.push({
      id: tx.agentUser.id,
      name: tx.agentUser.name ?? tx.agentUser.email,
      email: tx.agentUser.email,
      roleLabel: "Agent",
      kind: "agent",
      side: null,
      group: "sale",
      avatarUrl: tx.agentUser.image ?? null,
    });
  }

  // Both solicitors (side-tagged).
  const vSol = solicitorRecipient(
    tx.vendorSolicitorContact ? { ...tx.vendorSolicitorContact, firm: tx.vendorSolicitorFirm } : null,
    "vendor",
  );
  if (vSol) recipients.push(vSol);
  const pSol = solicitorRecipient(
    tx.purchaserSolicitorContact ? { ...tx.purchaserSolicitorContact, firm: tx.purchaserSolicitorFirm } : null,
    "purchaser",
  );
  if (pSol) recipients.push(pSol);

  // Your team — colleagues in the caller's own agency with a login email. Agency
  // users only (internal staff carry a null agencyId; they can still type a free
  // address). Excludes the caller themselves.
  if (session.user.agencyId) {
    const team = await prisma.user.findMany({
      where: {
        agencyId: session.user.agencyId,
        id: { not: session.user.id },
        role: { in: ["director", "negotiator"] },
        email: { not: "" },
      },
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });
    for (const u of team) {
      if (!u.email) continue;
      recipients.push({
        id: u.id,
        name: u.name ?? u.email,
        email: u.email,
        roleLabel: "Your team",
        kind: "team",
        side: null,
        group: "team",
        avatarUrl: u.image ?? null,
      });
    }
  }

  const { from } = await resolveSenderForTransaction(transactionId, session.user);
  const { line1, location } = splitComposeAddress(tx.propertyAddress);

  return {
    sale: { id: tx.id, address: tx.propertyAddress, line1, location, photoPath: tx.photoStoragePath },
    recipients,
    fromEmail: from,
  };
}
