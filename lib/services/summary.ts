// lib/services/summary.ts
// Generates human-readable update text from milestone completions.
// Uses contact names from the transaction to personalise the output.
// Template tokens: {agent} {vendors} {purchasers} {solicitor} {broker}

import { prisma } from "@/lib/prisma";
import { extractFirstName } from "@/lib/contacts/displayName";

/**
 * Resolve contact name tokens from a transaction's contacts.
 * Returns first names joined naturally: "Sarah", "Sarah and John", etc.
 */
export async function resolveTemplateTokens(
  transactionId: string,
  agentName: string
): Promise<Record<string, string>> {
  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId },
    select: { name: true, roleType: true },
  });

  const byRole = (role: string) => {
    const names = contacts
      .filter((c) => c.roleType === role)
      .map((c) => extractFirstName(c.name));
    if (names.length === 0) return role === "vendor" ? "the vendor" : role === "purchaser" ? "the purchaser" : "the solicitor";
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  };

  const solicitorContact = contacts.find((c) => c.roleType === "solicitor");
  const brokerContact = contacts.find((c) => c.roleType === "broker");

  return {
    agent: extractFirstName(agentName),
    vendors: byRole("vendor"),
    purchasers: byRole("purchaser"),
    solicitor: solicitorContact?.name ?? "the solicitor",
    broker: brokerContact?.name ?? "the broker",
  };
}

/**
 * Generate the full summary text for a milestone completion.
 * Format: "{agent} [template with tokens resolved]"
 */
export async function generateSummaryText(
  transactionId: string,
  summaryTemplate: string,
  agentName: string
): Promise<string> {
  if (!summaryTemplate) return "";

  const tokens = await resolveTemplateTokens(transactionId, agentName);

  let text = summaryTemplate;
  for (const [key, value] of Object.entries(tokens)) {
    text = text.replaceAll(`{${key}}`, value);
  }

  // Capitalise first letter
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Get the most recent active milestone completion for a transaction.
 * Used for "Last update" display on transaction detail and dashboard.
 */
export async function getLastUpdate(transactionId: string) {
  return prisma.milestoneCompletion.findFirst({
    where: {
      transactionId,
      state: "complete",
      summaryText: { not: null },
    },
    orderBy: { completedAt: "desc" },
    select: {
      completedAt: true,
      summaryText: true,
      milestoneDefinition: { select: { name: true } },
    },
  });
}

/**
 * Format a date as a relative string: "Today", "Yesterday", "3 days ago"
 */
export function relativeDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);

  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}
