// lib/chain/duplicate-detection.ts
// Conservative address matching for claim flow duplicate detection.
// Only flags a match when postcode AND first numeric component agree.
// Better to miss a match than to false-match.

import { prisma } from "@/lib/prisma";

// Extract postcode from a UK address string. Returns lowercased, space-normalised.
function extractPostcode(address: string): string | null {
  const match = address.match(
    /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i,
  );
  return match ? match[1].toLowerCase().replace(/\s+/g, " ").trim() : null;
}

// Extract the first numeric component (house number / flat number).
function extractFirstNumeric(address: string): string | null {
  const match = address.match(/\b(\d+[A-Z]?)\b/i);
  return match ? match[1].toLowerCase() : null;
}

export type DuplicateMatch = {
  transactionId: string;
  propertyAddress: string;
};

// Finds existing PropertyTransactions for a given agencyId whose address
// matches the stub address via postcode + first numeric. Returns all matches.
export async function findDuplicateTransactions(
  agencyId: string,
  stubAddress: string,
): Promise<DuplicateMatch[]> {
  const stubPostcode = extractPostcode(stubAddress);
  const stubNumeric = extractFirstNumeric(stubAddress);

  if (!stubPostcode || !stubNumeric) {
    // Cannot match without both components — return empty (no false positives)
    return [];
  }

  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: { not: "draft" } },
    select: { id: true, propertyAddress: true },
  });

  return transactions
    .map((txn) => ({ transactionId: txn.id, propertyAddress: txn.propertyAddress }))
    .filter((txn) => {
    const txnPostcode = extractPostcode(txn.propertyAddress);
    const txnNumeric = extractFirstNumeric(txn.propertyAddress);
    return (
      txnPostcode !== null &&
      txnNumeric !== null &&
      txnPostcode === stubPostcode &&
      txnNumeric === stubNumeric
    );
  });
}

// Quick boolean check — used to decide whether to show the "link existing"
// UI branch vs auto-proceed to "create new" branch.
export async function hasDuplicateTransaction(
  agencyId: string,
  stubAddress: string,
): Promise<boolean> {
  const matches = await findDuplicateTransactions(agencyId, stubAddress);
  return matches.length > 0;
}
