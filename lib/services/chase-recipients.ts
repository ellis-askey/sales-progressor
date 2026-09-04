// Shared, client-safe recipient model for the chase drawer.
//
// The chase drawer needs to offer the file's solicitor as a *primary* recipient,
// not just an email CC. Solicitors are NOT stored on the Contact table — they live
// in SolicitorFirm / SolicitorContact, wired to the transaction via the side-tagged
// FK columns vendor/purchaserSolicitorContactId (prisma/schema.prisma:385-388). The
// column the solicitor sits in IS its side, so no inference is needed.
//
// This module has no server-only imports on purpose: the drawer (client) and the
// generate-chase route (server) both build their recipient list from the same
// helpers so the selection made in the UI resolves to the same person server-side.
//
// See docs/active/chase-recipient-selector/SPEC.md.

export type ChaseSide = "vendor" | "purchaser";

// Superset of the drawer's local Contact shape. Client contacts arrive with only
// the base fields; solicitor recipients are injected with side / secondaryEmail /
// firmName populated so the drawer can label them and apply the email-only + no-CC
// rules without re-deriving anything.
export interface ChaseContact {
  id: string;
  name: string;
  roleType: string; // vendor | purchaser | broker | solicitor
  email?: string | null;
  phone?: string | null;
  side?: ChaseSide | null;
  secondaryEmail?: string | null;
  firmName?: string | null;
}

// The shape the four solicitor FK columns resolve to (SolicitorContact + firm).
// Matches the select in lib/services/transactions.ts.
export interface SolicitorRef {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  secondaryEmail?: string | null;
  firm?: { name: string } | null;
}

const CLIENT_ROLES = ["vendor", "purchaser", "broker"];

export function isSolicitorRecipient(c: ChaseContact): boolean {
  return c.roleType === "solicitor";
}

// Turn a resolved SolicitorContact FK into a ChaseContact recipient for the given
// side. Returns null when the FK is empty or the handler has no way to be reached.
export function solicitorToRecipient(
  sol: SolicitorRef | null | undefined,
  side: ChaseSide,
): ChaseContact | null {
  if (!sol) return null;
  // A solicitor with neither an email nor a phone can't be a recipient.
  if (!sol.email && !sol.phone) return null;
  return {
    id: sol.id,
    name: sol.name,
    roleType: "solicitor",
    email: sol.email ?? null,
    phone: sol.phone ?? null,
    side,
    secondaryEmail: sol.secondaryEmail ?? null,
    firmName: sol.firm?.name ?? null,
  };
}

// Inject the correct-side solicitor(s) into an already side-scoped contact list.
// - side given  -> only that side's solicitor is added.
// - side null   -> both present solicitors are added (used by chase-all, which can
//                  span mixed sides).
// Existing solicitor entries are not duplicated (guards the rare case where a
// solicitor Contact row does exist on legacy data).
export function withSolicitorRecipients(
  contacts: ChaseContact[],
  opts: {
    vendorSolicitor?: SolicitorRef | null;
    purchaserSolicitor?: SolicitorRef | null;
    side?: ChaseSide | null;
  },
): ChaseContact[] {
  const { vendorSolicitor, purchaserSolicitor, side = null } = opts;
  const additions: ChaseContact[] = [];

  const wantVendor = side === null || side === "vendor";
  const wantPurchaser = side === null || side === "purchaser";

  if (wantVendor) {
    const r = solicitorToRecipient(vendorSolicitor, "vendor");
    if (r) additions.push(r);
  }
  if (wantPurchaser) {
    const r = solicitorToRecipient(purchaserSolicitor, "purchaser");
    if (r) additions.push(r);
  }

  const existingIds = new Set(contacts.map((c) => c.id));
  const fresh = additions.filter((a) => !existingIds.has(a.id));
  return [...contacts, ...fresh];
}

// The default recipient the drawer pre-selects. Client-first, solicitor fallback,
// then any addressable contact — identical to the drawer's previous
// `clientContact ?? solicitorContact ?? contacts.find(email)` order, so wiring the
// selector in does not change who a chase goes to by default.
export function defaultRecipient(contacts: ChaseContact[]): ChaseContact | null {
  return (
    contacts.find((c) => CLIENT_ROLES.includes(c.roleType) && c.email) ??
    contacts.find((c) => isSolicitorRecipient(c) && c.email) ??
    contacts.find((c) => c.email || c.phone) ??
    null
  );
}

// Side-aware role wording for a single recipient. Buyer-facing wording per VOICE.md
// (Law 21): "Buyer's solicitor", not "Purchaser's solicitor".
export function recipientRoleLabel(c: ChaseContact): string {
  if (isSolicitorRecipient(c)) {
    const side = c.side === "purchaser" ? "Buyer's" : "Vendor's";
    return c.firmName ? `${side} solicitor (${c.firmName})` : `${side} solicitor`;
  }
  if (c.roleType === "broker") return "Mortgage broker";
  if (c.roleType === "purchaser") return "Buyer";
  if (c.roleType === "vendor") return "Vendor";
  return c.roleType.charAt(0).toUpperCase() + c.roleType.slice(1);
}

// One-line label for a recipient row: "Jane Smith · Vendor".
export function recipientLabel(c: ChaseContact): string {
  return `${c.name} · ${recipientRoleLabel(c)}`;
}

// Join a list of names naturally: "A", "A & B", "A, B & C".
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// Who owes the action for a chase, named. Uses the milestone side (VM/PM) plus the
// glossary's responsible party (client vs solicitor) to pick the right person(s).
// `role` is only set when it adds something the side pill doesn't already show:
// null for the seller/buyer (the pill says so), "solicitor"/"mortgage broker"
// otherwise. Names every principal on the side (joint sellers/buyers). Client-safe.
export function whoToChase(opts: {
  side: ChaseSide;
  responsible: "client" | "solicitor" | null;
  contacts: { name: string; roleType: string }[];
  vendorSolicitor?: SolicitorRef | null;
  purchaserSolicitor?: SolicitorRef | null;
}): { name: string; role: string | null } | null {
  const { side, responsible, contacts, vendorSolicitor, purchaserSolicitor } = opts;
  const sol = side === "vendor" ? vendorSolicitor : purchaserSolicitor;
  const solName = sol ? (sol.firm?.name || sol.name) : null;

  if (responsible === "solicitor" && solName) return { name: solName, role: "solicitor" };

  // Client side: name every principal (joint sellers / joint buyers).
  const clientRole = side === "vendor" ? "vendor" : "purchaser";
  const clients = contacts.filter((c) => c.roleType === clientRole).map((c) => c.name);
  if (clients.length > 0) return { name: joinNames(clients), role: null };

  const broker = contacts.find((c) => c.roleType === "broker");
  if (broker) return { name: broker.name, role: "mortgage broker" };

  if (solName) return { name: solName, role: "solicitor" };
  return null;
}
