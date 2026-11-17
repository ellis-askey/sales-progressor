// Server-side resolution of template variable values for a specific file.
// Reuses the access-scope guard so a user can only resolve files they may see.
// Never invents a missing value — returns null for anything genuinely absent.

import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import type { TemplateVarValues } from "./variables";

function fmtDate(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

// Join principal client names on a side: "Alex", "Alex & Sam", "A, B & C".
function joinNames(names: string[]): string | null {
  const clean = names.map((n) => (n || "").trim()).filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} & ${clean[clean.length - 1]}`;
}

export type ResolvedTemplateContext = { label: string; values: TemplateVarValues };

export async function resolveTemplateValuesForFile(
  transactionId: string,
  session: Session,
): Promise<ResolvedTemplateContext | null> {
  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      propertyAddress: true,
      expectedExchangeDate: true,
      completionDate: true,
      agentUser: { select: { name: true } },
      assignedUser: { select: { name: true } },
      contacts: { where: { isPrincipal: true }, select: { name: true, roleType: true } },
    },
  });
  if (!tx) return null;

  const buyers = tx.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name);
  const sellers = tx.contacts.filter((c) => c.roleType === "vendor").map((c) => c.name);
  // Who looks after the file (assigned progressor wins, else the agent), falling
  // back to the current user's name for the agent-name variable.
  const agent = (tx.assignedUser?.name || tx.agentUser?.name || session.user.name || "").trim();

  const values: TemplateVarValues = {
    property_address: tx.propertyAddress?.trim() || null,
    buyer_name: joinNames(buyers),
    seller_name: joinNames(sellers),
    agent_name: agent || null,
    target_exchange_date: fmtDate(tx.expectedExchangeDate),
    target_completion_date: fmtDate(tx.completionDate),
  };

  return { label: tx.propertyAddress?.trim() || "this file", values };
}
