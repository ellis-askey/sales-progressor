// Provider availability for the buyer portal (2026-09-14).
//
// The "Need anything else?" providers card on the portal overview links the
// buyer back to the /quote marketplace once their survey is booked. We only
// show it when there is genuinely something local to book, so the buyer never
// taps through to an empty picker.
//
// "Local" here means the postcode-gated kinds only: surveyors and structural
// engineers, matched on the outward code of the property being bought (the
// same coverage gate /quote applies — see app/quote/[token]/page.tsx). Mortgage
// brokers are nationwide and have their own dedicated card + drawer, so a lone
// broker does NOT keep this card visible.

import { prisma } from "@/lib/prisma";
import type { ProviderKind } from "@prisma/client";
import { outwardCode } from "@/lib/utils/address";

// Postcode-gated provider kinds. Kept in step with the coverage query in
// app/quote/[token]/page.tsx.
const LOCAL_KINDS: ProviderKind[] = ["surveyor", "structural_engineer"];

const KIND_CARD_LABELS: Record<string, string> = {
  surveyor: "surveys",
  structural_engineer: "structural reports",
};

export type ProviderAvailability = {
  // Outward code parsed from the buying address, or null when unparseable.
  outward: string | null;
  // True when at least one local (surveyor / structural engineer) firm covers
  // the area. This is the gate for the providers card.
  hasLocalCovered: boolean;
  // Short lowercase labels for the kinds actually available, so the card copy
  // never advertises a category with no covering firm.
  availableLabels: string[];
};

/**
 * Resolve which local provider kinds cover the area of `address`. Used to gate
 * (and phrase) the buyer portal's "Need anything else?" providers card.
 */
export async function resolveProviderAvailability(
  address: string,
): Promise<ProviderAvailability> {
  const outward = outwardCode(address);
  if (!outward) return { outward: null, hasLocalCovered: false, availableLabels: [] };

  const firms = await prisma.providerFirm.findMany({
    where: {
      kind: { in: LOCAL_KINDS },
      active: true,
      coverage: { some: { outwardCode: outward } },
    },
    select: { kind: true },
  });

  const kindsPresent = new Set<ProviderKind>(firms.map((f) => f.kind));
  const availableLabels = LOCAL_KINDS.filter((k) => kindsPresent.has(k)).map(
    (k) => KIND_CARD_LABELS[k],
  );

  return { outward, hasLocalCovered: firms.length > 0, availableLabels };
}
