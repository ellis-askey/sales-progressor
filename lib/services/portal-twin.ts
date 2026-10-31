// Person-tie for the onward portal mirror (docs/active/onward-portal-mirror.md).
//
// Each portal token opens ONE contact on ONE file, and confirmations run through
// that token. So to let someone confirm their neighbour file's steps from their
// sale link, we resolve THEIR OWN contact + token on that neighbour file and
// render its real steps under it — fully legitimate, no new auth model.
//
// We tie by unambiguous match: email first (the stronger signal), then full name
// (title-stripped). The two files are already deliberately chain-linked as the
// same client's move, so within that pair an unambiguous match is strong. Where
// there's no confident match we return null and the side tab falls back to
// read-only. A durable, agent-confirmed tie (for the genuinely ambiguous cases)
// is the remaining Phase 2 piece — it needs a schema change, which is held back
// by the staging `db push` / bodySearch hazard (see the spec).

import { prisma } from "@/lib/prisma";
import { TITLE_PREFIXES } from "@/lib/contacts/displayName";

export type TwinContact = { contactId: string; portalToken: string | null };

const normEmail = (e: string | null | undefined): string | null => {
  const v = e?.trim().toLowerCase();
  return v ? v : null;
};

// Normalised identity key from a name: lowercased, any leading title dropped,
// whitespace collapsed. Requires at least two REAL name words (first + surname)
// — a lone first name, a bare surname, or title + surname ("Mr Stevens") is too
// weak to tie people across files.
const normName = (name: string | null | undefined): string | null => {
  if (!name) return null;
  const words = name.trim().toLowerCase().replace(/\./g, "").split(/\s+/).filter(Boolean);
  const rest = words.length > 1 && TITLE_PREFIXES.has(words[0]) ? words.slice(1) : words;
  return rest.length >= 2 ? rest.join(" ") : null;
};

// Pure matcher: the same person on the neighbour file, by unambiguous email.
export function matchTwinByEmail(
  sourceEmail: string | null,
  candidates: { id: string; email: string | null; portalToken: string | null }[],
): TwinContact | null {
  const src = normEmail(sourceEmail);
  if (!src) return null;
  const hits = candidates.filter((c) => normEmail(c.email) === src);
  if (hits.length !== 1) return null;
  return { contactId: hits[0].id, portalToken: hits[0].portalToken };
}

// Pure matcher: the same person by unambiguous (title-stripped, 2+ word) name.
export function matchTwinByName(
  sourceName: string | null,
  candidates: { id: string; name: string; portalToken: string | null }[],
): TwinContact | null {
  const src = normName(sourceName);
  if (!src) return null;
  const hits = candidates.filter((c) => normName(c.name) === src);
  if (hits.length !== 1) return null;
  return { contactId: hits[0].id, portalToken: hits[0].portalToken };
}

// Combined: email first (stronger), then name. Null when neither is confident.
export function matchTwin(
  source: { email: string | null; name: string | null },
  candidates: { id: string; email: string | null; name: string; portalToken: string | null }[],
): TwinContact | null {
  return matchTwinByEmail(source.email, candidates) ?? matchTwinByName(source.name, candidates);
}

// DB wrapper: resolve the twin of `sourceContactId` on `neighbourFileId`. A
// stored tie (shared personGroupId, set at self-link time) wins — it's durable
// even if email/name later change — then we fall back to auto-matching.
export async function resolveTwinContactOnFile(
  sourceContactId: string,
  neighbourFileId: string,
): Promise<TwinContact | null> {
  const source = await prisma.contact.findUnique({
    where: { id: sourceContactId },
    select: { email: true, name: true, personGroupId: true },
  });
  if (!source) return null;

  if (source.personGroupId) {
    const tied = await prisma.contact.findFirst({
      where: { propertyTransactionId: neighbourFileId, personGroupId: source.personGroupId },
      select: { id: true, portalToken: true },
    });
    if (tied) return { contactId: tied.id, portalToken: tied.portalToken };
  }

  const candidates = await prisma.contact.findMany({
    where: { propertyTransactionId: neighbourFileId },
    select: { id: true, email: true, name: true, portalToken: true },
  });
  return matchTwin({ email: source.email, name: source.name }, candidates);
}

// Persist "same person" ties between two chain-linked own files, so the mirror
// stays confirmable even if a contact's email/name is edited later. Matches each
// contact on file A to an unambiguous twin on file B (email then name) and gives
// the pair a shared personGroupId. The group id is derived from the two contact
// ids so re-running at a later self-link is idempotent (no duplicate groups).
// Returns how many pairs were tied. Only ties what auto-match already finds —
// the genuinely ambiguous remainder needs the (future) agent "same person?"
// prompt. Call fire-and-forget; a failure here must never block the self-link.
export async function tieOwnFilePeople(fileAId: string, fileBId: string): Promise<number> {
  const [aContacts, bContacts] = await Promise.all([
    prisma.contact.findMany({ where: { propertyTransactionId: fileAId }, select: { id: true, email: true, name: true, personGroupId: true } }),
    prisma.contact.findMany({ where: { propertyTransactionId: fileBId }, select: { id: true, email: true, name: true, personGroupId: true } }),
  ]);
  const bCandidates = bContacts.map((b) => ({ id: b.id, email: b.email, name: b.name, portalToken: null }));
  let tied = 0;
  for (const a of aContacts) {
    const match = matchTwin({ email: a.email, name: a.name }, bCandidates);
    if (!match) continue;
    const b = bContacts.find((x) => x.id === match.contactId);
    if (!b) continue;
    const groupId = a.personGroupId ?? b.personGroupId ?? `pg_${[a.id, b.id].sort().join("_")}`;
    await prisma.contact.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { personGroupId: groupId } });
    tied++;
  }
  return tied;
}
