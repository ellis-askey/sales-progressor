// Natural-language confirmation sentences for the Updates surfaces (the bell
// drawer, the /agent/comms feed). Each milestone has a possessive "core" (the
// bit that follows "her" / "Joanne's"); the builder wraps it per confirmer:
//
//   client confirms  -> "Joanne Phillips confirmed her mortgage application has been submitted"
//   agent confirms   -> "Ellis Askey confirmed that Joanne Phillips' mortgage application has been submitted"
//   solicitor        -> "Cameron & Co confirmed that Joanne Phillips' solicitor has ordered the searches"
//
// Names + pronouns: one client -> his/her from title (else their); two or more
// -> always "their", and when someone else confirms, all clients are named.
// Reviewed + approved by Ellis 2026-08-12.

// The possessive core per code. VM19/PM26 (exchange) are non-possessive and
// live in GENERAL below.
const CORES: Record<string, string> = {
  // Seller
  VM1: "solicitor has been instructed",
  VM2: "memorandum of sale has arrived",
  VM3: "solicitor's welcome pack has arrived",
  VM4: "ID and AML checks are complete",
  VM5: "property information forms have arrived",
  VM6: "completed property forms have been returned",
  VM7: "solicitor has issued the draft contract pack",
  VM8: "solicitor has requested the management pack",
  VM9: "solicitor has received the management pack",
  VM10: "solicitor has received the initial enquiries",
  VM11: "solicitor now has the initial replies",
  VM12: "solicitor has replied to the buyer's solicitor",
  VM13: "solicitor has received the additional enquiries",
  VM14: "solicitor now has the additional replies",
  VM15: "solicitor has sent the additional replies on",
  VM16: "contract is ready to sign",
  VM17: "contract has been signed and returned",
  VM18: "solicitor is ready to exchange",
  VM20: "sale has completed",
  // Buyer
  PM1: "solicitor has been instructed",
  PM2: "memorandum of sale has arrived",
  PM3: "ID and AML checks are complete",
  PM4: "money on account has been paid to the solicitor",
  PM5: "mortgage application has been submitted",
  PM6: "lender's valuation has been booked",
  PM7: "solicitor has received the draft contract pack",
  PM8: "solicitor has ordered the searches",
  PM9: "survey has been booked",
  PM10: "survey report has arrived",
  PM11: "mortgage offer has come through",
  PM12: "solicitor has received the management pack",
  PM13: "searches have come back for review",
  PM14: "solicitor has raised the initial enquiries",
  PM15: "solicitor has received the initial replies",
  PM16: "solicitor has reviewed the initial replies",
  PM17: "solicitor has raised additional enquiries",
  PM18: "solicitor has received the additional replies",
  PM19: "solicitor has reviewed the additional replies",
  PM20: "enquiries are all satisfied now",
  PM21: "solicitor's final report has arrived",
  PM22: "contract is ready to sign",
  PM23: "contract has been signed and returned",
  PM24: "deposit has been transferred",
  PM25: "solicitor is ready to exchange",
  PM27: "purchase has completed",
};

// Non-possessive facts (contracts exchanged): same clause however it's said.
const GENERAL: Record<string, string> = {
  VM19: "contracts have exchanged",
  PM26: "contracts have exchanged",
};

export type UpdateConfirmer =
  | { kind: "client" }
  | { kind: "agent"; name: string }
  | { kind: "solicitor"; firm: string };

export type SideContact = { name: string; title?: string | null };

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
function clientPossessive(contacts: SideContact[], side: "vendor" | "purchaser"): string {
  if (contacts.length === 0) return side === "vendor" ? "the seller's" : "the buyer's";
  return possessive(joinNames(contacts.map((c) => c.name)));
}
function primaryClientName(contacts: SideContact[], side: "vendor" | "purchaser"): string {
  return contacts[0]?.name ?? (side === "vendor" ? "The seller" : "The buyer");
}
function clientPronoun(contacts: SideContact[]): "his" | "her" | "their" {
  // Two or more clients -> always "their". One client -> his/her from a title
  // (a title field, or a leading "Mr/Mrs/Ms/Miss/Dr" on the name), else "their".
  if (contacts.length !== 1) return "their";
  const c = contacts[0];
  const t = (c.title ?? c.name.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/\./g, "");
  if (t === "mr") return "his";
  if (t === "mrs" || t === "ms" || t === "miss") return "her";
  return "their";
}

/** Build the third-person confirmation sentence for the agent Updates surfaces.
 *  milestoneName is the plain step name, used as a safety fallback if a code
 *  ever has no written core. */
export function confirmationSentence(opts: {
  code: string;
  side: "vendor" | "purchaser";
  confirmer: UpdateConfirmer;
  sideContacts: SideContact[];
  milestoneName: string;
}): string {
  const { code, side, confirmer, sideContacts, milestoneName } = opts;
  const general = GENERAL[code];
  const core = CORES[code];

  if (confirmer.kind === "client") {
    const name = primaryClientName(sideContacts, side);
    if (general) return `${name} confirmed ${general}`;
    if (!core) return `${name} confirmed: ${milestoneName}`;
    return `${name} confirmed ${clientPronoun(sideContacts)} ${core}`;
  }

  const who = confirmer.kind === "agent" ? confirmer.name : confirmer.firm;
  if (general) return `${who} confirmed that ${general}`;
  if (!core) return `${who} confirmed: ${milestoneName}`;
  return `${who} confirmed that ${clientPossessive(sideContacts, side)} ${core}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Client-portal wording. When the step is on the VIEWER's own side it's
 *  second person ("You confirmed your survey…", "Ellis Askey confirmed your
 *  survey…"). When it's the OTHER party's step it's a plain third-person fact
 *  with no confirmer named ("The seller's solicitor has issued the draft
 *  contract pack"). */
export function portalConfirmationSentence(opts: {
  code: string;
  side: "vendor" | "purchaser";
  viewerSide: "vendor" | "purchaser";
  confirmer: UpdateConfirmer;
  milestoneName: string;
}): string {
  const { code, side, viewerSide, confirmer, milestoneName } = opts;
  const general = GENERAL[code];
  const core = CORES[code];

  // The other party's progress — generic, no name, no confirmer.
  if (side !== viewerSide) {
    const party = side === "vendor" ? "seller" : "buyer";
    if (general) return capitalise(general);
    if (!core) return milestoneName;
    return capitalise(`the ${party}'s ${core}`);
  }

  // The viewer's own step.
  if (confirmer.kind === "client") {
    if (general) return `You confirmed ${general}`;
    if (!core) return `You confirmed: ${milestoneName}`;
    return `You confirmed your ${core}`;
  }
  const who = confirmer.kind === "agent" ? confirmer.name : confirmer.firm;
  if (general) return `${who} confirmed that ${general}`;
  if (!core) return `${who} confirmed: ${milestoneName}`;
  return `${who} confirmed your ${core}`;
}

// ── Bell phrasing for non-confirmation client updates (audit #6 follow-on) ──
// Clients who reply to a chase can set an expected date or leave a note. Those
// already create Notifications (portal_expected_date_set / portal_chase_note)
// — this renders them as warm, for-your-awareness sentences in the bell,
// alongside confirmations. Names the person who actually updated us; uses
// singular "they" (we don't store gender); the client's own words go in quotes.
function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

export function bellNotificationSentence(type: string, payload: Record<string, unknown>): string {
  const name = String(payload.contactName ?? "A client");
  const label = lowerFirst(String(payload.milestoneLabel ?? "their sale"));
  if (type === "portal_expected_date_set") {
    const raw = payload.expectedDate ? new Date(String(payload.expectedDate)) : null;
    const date = raw && !isNaN(raw.getTime())
      ? raw.toLocaleDateString("en-GB", { day: "numeric", month: "long" })
      : "soon";
    return `We followed up with ${name} about ${label}. They expect it by ${date}.`;
  }
  if (type === "portal_chase_note") {
    const note = String(payload.notePreview ?? "").trim();
    return `We followed up with ${name} about ${label}, and they replied: "${note}"`;
  }
  // portal_chain_agent_updated + any other allowlisted type carry a
  // pre-rendered body/title in their payload.
  return String(payload.body ?? payload.title ?? "Update on your file");
}
