"use server";

// Onward portal mirror — Phase 2 agent "same person?" matcher actions
// (docs/active/onward-portal-mirror.md). Reads the people on a file that
// auto-match couldn't tie to their twin on the chain-neighbour file, and writes
// the agent's confirmed matches as a shared Contact.personGroupId. Law 7: every
// read/write is scope-checked; a contact on the neighbour is only accepted when
// that neighbour is a same-team chain file (resolveOwnOnwardFileId).

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { resolveOwnOnwardFileId } from "@/lib/services/onward";
import { matchTwin } from "@/lib/services/portal-twin";

type Kind = "onward_purchase" | "related_sale";

const roleLabel = (r: string) =>
  r === "vendor" ? "Seller" : r === "purchaser" ? "Buyer" : r === "broker" ? "Broker" : r;

export type OnwardMatchContext =
  | { ok: false; reason: "not_found" | "no_neighbour" }
  | {
      ok: true;
      neighbourId: string;
      ourAddress: string;
      neighbourAddress: string;
      ourContacts: { id: string; name: string; email: string | null; roleLabel: string }[];
      theirContacts: { id: string; name: string; email: string | null; roleLabel: string }[];
    };

export async function getOnwardMatchContext(
  transactionId: string,
  kind: Kind = "onward_purchase",
): Promise<OnwardMatchContext> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const own = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true, propertyAddress: true },
  });
  if (!own) return { ok: false, reason: "not_found" };

  const neighbourId = await resolveOwnOnwardFileId(transactionId, kind);
  if (!neighbourId) return { ok: false, reason: "no_neighbour" };
  const neighbour = await prisma.propertyTransaction.findUnique({
    where: { id: neighbourId },
    select: { propertyAddress: true },
  });

  // The side of OUR file that faces the neighbour: our seller buys the file above
  // (onward), our buyer sells the file below (related sale).
  const ourSide = kind === "onward_purchase" ? "vendor" : "purchaser";
  const [ours, theirs] = await Promise.all([
    prisma.contact.findMany({
      where: { propertyTransactionId: transactionId, roleType: ourSide },
      select: { id: true, name: true, email: true, roleType: true, personGroupId: true },
    }),
    prisma.contact.findMany({
      where: { propertyTransactionId: neighbourId },
      select: { id: true, name: true, email: true, roleType: true, personGroupId: true },
    }),
  ]);

  const candidates = theirs.map((t) => ({ id: t.id, email: t.email, name: t.name, portalToken: null }));
  // Only surface the people with NO stored tie AND no confident auto-match — the
  // exception the matcher exists for.
  const needing = ours.filter((c) => {
    if (c.personGroupId && theirs.some((t) => t.personGroupId === c.personGroupId)) return false;
    return matchTwin({ email: c.email, name: c.name }, candidates) == null;
  });

  return {
    ok: true,
    neighbourId,
    ourAddress: own.propertyAddress,
    neighbourAddress: neighbour?.propertyAddress ?? "the onward file",
    ourContacts: needing.map((c) => ({ id: c.id, name: c.name, email: c.email, roleLabel: roleLabel(c.roleType) })),
    theirContacts: theirs.map((t) => ({ id: t.id, name: t.name, email: t.email, roleLabel: roleLabel(t.roleType) })),
  };
}

export async function saveOnwardPersonTiesAction(
  transactionId: string,
  pairs: { ourContactId: string; theirContactId: string }[],
): Promise<{ ok: boolean; tied: number; error?: string }> {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const own = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!own) return { ok: false, tied: 0, error: "not_found" };

  // A neighbour contact is only valid if it sits on one of this file's OWN
  // (same-team) chain neighbours — never an arbitrary file id from the client.
  const neighbourIds = (
    await Promise.all([
      resolveOwnOnwardFileId(transactionId, "onward_purchase"),
      resolveOwnOnwardFileId(transactionId, "related_sale"),
    ])
  ).filter((v): v is string => !!v);

  let tied = 0;
  for (const { ourContactId, theirContactId } of pairs) {
    const [a, b] = await Promise.all([
      prisma.contact.findUnique({ where: { id: ourContactId }, select: { id: true, personGroupId: true, propertyTransactionId: true } }),
      prisma.contact.findUnique({ where: { id: theirContactId }, select: { id: true, personGroupId: true, propertyTransactionId: true } }),
    ]);
    if (!a || !b) continue;
    if (a.propertyTransactionId !== transactionId) continue;
    if (!neighbourIds.includes(b.propertyTransactionId)) continue;
    const groupId = a.personGroupId ?? b.personGroupId ?? `pg_${[a.id, b.id].sort().join("_")}`;
    await prisma.contact.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { personGroupId: groupId } });
    tied++;
  }
  return { ok: true, tied };
}
