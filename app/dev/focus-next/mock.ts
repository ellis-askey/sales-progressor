// Focus Next — prototype seed data + derivation helpers. Isolated to /dev; no DB,
// no server, no shared state. Times are stored as `daysAgo` (fractional = hours)
// so the data is deterministic and needs no fixed "now".
//
// INVENTED-FOR-PROTOTYPE rules are marked `INVENTED:` — they are demonstration
// prioritisation, not current TSP behaviour.

export type Channel = "email" | "whatsapp" | "call";
export type CommState =
  | "replied" | "opened" | "delivered" | "sent" | "messaged" | "called" | "logged" | "bounced" | "failed";
export type CommDir = "in" | "out";

export type Comm = {
  channel: Channel;
  dir: CommDir;
  state: CommState;
  daysAgo: number;          // 0.2 ≈ 5h ago
  automated?: boolean;      // engine-sent; never counts as human contact
  subject?: string;         // email
  preview?: string;         // whatsapp / call note
};

export type SideKind = "vendor" | "purchaser";

export type Side = {
  kind: SideKind;
  names: string;
  comms: Comm[];
  touchedThisWeek: boolean; // human contact this ISO week (set by actions / seeded)
  parked: boolean;          // deliberately "not required" this week
};

export type ConcernKind = "enquiry" | "search";
export type Tone = "danger" | "warn" | "info" | "ok";
export type Concern = {
  kind: ConcernKind;
  tone: Tone;
  title: string;            // the headline reason
  detail: string;           // one supporting line
  days: number;
};

export type Sale = {
  id: string;
  line1: string;
  town: string;
  postcode: string;
  pricePence: number | null;
  stage: string;
  vendor: Side | null;
  purchaser: Side | null;
  concerns: Concern[];
};

// ── seed helpers ─────────────────────────────────────────────────────────────
const c = (channel: Channel, dir: CommDir, state: CommState, daysAgo: number, extra?: Partial<Comm>): Comm =>
  ({ channel, dir, state, daysAgo, ...extra });

const side = (kind: SideKind, names: string, comms: Comm[], o?: Partial<Side>): Side =>
  ({ kind, names, comms, touchedThisWeek: false, parked: false, ...o });

let n = 0;
const sale = (
  line1: string, town: string, postcode: string, pricePence: number | null, stage: string,
  vendor: Side | null, purchaser: Side | null, concerns: Concern[] = [],
): Sale => ({ id: `s${++n}`, line1, town, postcode, pricePence, stage, vendor, purchaser, concerns });

// ── the book: ~20 sales spanning every circumstance ──────────────────────────
export const SALES: Sale[] = [
  // Stalled enquiry + overdue search + both sides long quiet — the worst file.
  sale("14 Pennington Grove", "Harpenden", "AL5 2RD", 68_5000_00, "Enquiries",
    side("vendor", "Margaret & Roy Ellison", [
      c("email", "out", "sent", 17, { automated: true, subject: "Weekly update: your sale" }),
      c("email", "out", "opened", 24, { subject: "Replies to buyer's enquiries" }),
      c("call", "out", "called", 31, { preview: "Left voicemail about the survey" }),
    ]),
    side("purchaser", "Daniel Osei", [
      c("email", "out", "sent", 15, { subject: "Chasing your solicitor's enquiries" }),
      c("whatsapp", "in", "replied", 19, { preview: "Thanks, will chase them today" }),
    ]),
    [
      { kind: "enquiry", tone: "danger", title: "Enquiries stalled", detail: "No movement for 15 days, nobody chasing it", days: 15 },
      { kind: "search", tone: "warn", title: "Searches outstanding 23 days", detail: "Ordered 23 Sep · results not back", days: 23 },
    ]),

  // Escalating enquiry; vendor awaiting reply; purchaser fine.
  sale("7 Marlborough Court", "St Albans", "AL1 3XF", 52_0000_00, "Enquiries",
    side("vendor", "Priya Nair", [
      c("email", "out", "delivered", 3.1, { subject: "Your solicitor needs the FENSA certificate" }),
      c("email", "in", "replied", 11, { preview: "Found the paperwork, sending over" }),
    ]),
    side("purchaser", "Tom & Beth Hargreaves", [
      c("whatsapp", "out", "messaged", 2.0, { preview: "Survey booked for Thursday" }),
      c("whatsapp", "in", "replied", 1.8, { preview: "Perfect, thank you" }),
    ], { touchedThisWeek: true }),
    [{ kind: "enquiry", tone: "danger", title: "Enquiries escalating", detail: "Second chase overdue, needs a push", days: 13 }]),

  // Bounced email on the buyer — needs a fix, obvious failure.
  sale("Flat 2, 88 Verulam Road", "Watford", "WD17 1EP", 31_5000_00, "Searches",
    side("vendor", "Grace Adeyemi", [
      c("email", "out", "opened", 5.0, { subject: "Searches are in: here's where we are" }),
    ], { touchedThisWeek: true }),
    side("purchaser", "Callum Fraser", [
      c("email", "out", "bounced", 1.2, { subject: "Your mortgage valuation is booked" }),
      c("call", "out", "called", 9, { preview: "Discussed timeline, all happy" }),
    ]),
    [{ kind: "search", tone: "warn", title: "Searches outstanding 16 days", detail: "Local authority slow, worth a chase", days: 16 }]),

  // Pure awaiting-reply: both sides messaged, no reply, a few days old.
  sale("23 Cowper Road", "Berkhamsted", "HP4 3DT", 74_0000_00, "Exchange",
    side("vendor", "Eleanor Whitcombe", [
      c("email", "out", "delivered", 4.0, { subject: "Ready to exchange: can you confirm?" }),
    ]),
    side("purchaser", "Mohammed & Layla Rahman", [
      c("whatsapp", "out", "messaged", 3.3, { preview: "Just need your deposit confirmation" }),
    ]),
    []),

  // Long-quiet vendor (5 weeks), purchaser healthy. No enquiry/search concern.
  sale("5 Gade Avenue", "Hemel Hempstead", "HP1 1BS", 38_0000_00, "Enquiries",
    side("vendor", "Bernard Holloway", [
      c("call", "out", "called", 36, { preview: "Caught up on the chain position" }),
      c("email", "out", "sent", 40, { automated: true, subject: "Your sale: what happens next" }),
    ]),
    side("purchaser", "Sophie Clarke", [
      c("email", "in", "replied", 4.5, { preview: "Great, thanks for the update" }),
      c("email", "out", "opened", 6, { subject: "Where your purchase stands" }),
    ], { touchedThisWeek: true }),
    []),

  // Overdue searches only (21+ days), both sides recently in touch.
  sale("41 Sandridge Road", "St Albans", "AL1 4AG", 45_5000_00, "Searches",
    side("vendor", "Imogen Blythe", [c("call", "out", "called", 2.0, { preview: "Reassured on the delay" })], { touchedThisWeek: true }),
    side("purchaser", "George Nkemelu", [c("email", "out", "opened", 2.3, { subject: "Quick update on searches" })], { touchedThisWeek: true }),
    [{ kind: "search", tone: "danger", title: "Searches outstanding 27 days", detail: "Well over the usual window, chase today", days: 27 }]),

  // Parked vendor (not required), purchaser awaiting reply.
  sale("12 Lattimore Road", "St Albans", "AL1 3XY", 61_0000_00, "Enquiries",
    side("vendor", "The Fenwick Estate", [c("email", "out", "sent", 8, { subject: "Probate paperwork received" })], { parked: true }),
    side("purchaser", "Aisha Bello", [
      c("email", "out", "delivered", 6.0, { subject: "Your searches have been ordered" }),
    ]),
    []),

  // Already progressed this week, both sides — a healthy, on-track sale.
  sale("3 Beechwood Rise", "Tring", "HP23 5JP", 42_5000_00, "Searches",
    side("vendor", "Nathaniel Okoro", [
      c("whatsapp", "in", "replied", 1.1, { preview: "Thanks, that's reassuring" }),
      c("whatsapp", "out", "messaged", 1.2, { preview: "Searches are progressing nicely" }),
    ], { touchedThisWeek: true }),
    side("purchaser", "Hannah & Oliver Pryce", [
      c("email", "out", "replied", 1.0, { subject: "Mortgage offer received" }),
    ], { touchedThisWeek: true }),
    []),

  // Multiple overlapping concerns: stalled enquiry + bounced + quiet purchaser.
  sale("29 Holywell Hill", "St Albans", "AL1 1HD", 89_5000_00, "Enquiries",
    side("vendor", "Dr Vanessa Crewe", [
      c("email", "out", "opened", 7, { subject: "Outstanding enquiries summary" }),
      c("call", "in", "called", 12, { preview: "Asked about completion timing" }),
    ]),
    side("purchaser", "Ryan Doyle", [
      c("email", "out", "bounced", 3.0, { subject: "We need your ID documents" }),
      c("email", "out", "sent", 20, { subject: "Welcome, and your next steps" }),
    ]),
    [{ kind: "enquiry", tone: "danger", title: "Enquiries stalled", detail: "11 days silent, buyer's ID still outstanding", days: 11 }]),

  // Never contacted purchaser (brand new side), vendor recent.
  sale("6 Faircross Way", "Welwyn", "AL6 0QT", 36_0000_00, "Instructed",
    side("vendor", "Patricia Lund", [c("email", "out", "opened", 2.5, { subject: "Welcome to your sale" })], { touchedThisWeek: true }),
    side("purchaser", "Jude Fairbanks", [], undefined),
    []),

  // WhatsApp-led relationship, unanswered WhatsApp 4 days.
  sale("18 Tavistock Avenue", "Harpenden", "AL5 5EP", 55_0000_00, "Searches",
    side("vendor", "Colin & Maureen Fox", [
      c("whatsapp", "out", "messaged", 4.2, { preview: "Any questions on the search results?" }),
      c("whatsapp", "in", "replied", 10, { preview: "All looks fine to us" }),
    ]),
    side("purchaser", "Yusuf Demir", [c("call", "out", "called", 5, { preview: "Talked through the survey" })]),
    []),

  // Healthy, unremarkable — nothing urgent, both touched last week not this.
  sale("2 Rose Walk", "Radlett", "WD7 7JS", 47_0000_00, "Exchange",
    side("vendor", "Stephanie Mboto", [c("email", "out", "opened", 9, { subject: "Exchange is close" })]),
    side("purchaser", "Alexander Reid", [c("email", "out", "opened", 8.5, { subject: "Almost there" })]),
    []),

  // Failed WhatsApp send + escalating enquiry.
  sale("57 Camp Road", "St Albans", "AL1 5HL", 43_0000_00, "Enquiries",
    side("vendor", "Harriet Vale", [c("whatsapp", "out", "failed", 2.1, { preview: "Draft replies attached" })]),
    side("purchaser", "Dev & Anita Sharma", [c("email", "in", "replied", 6, { preview: "Chasing our solicitor now" })]),
    [{ kind: "enquiry", tone: "warn", title: "Enquiries need you", detail: "Replies drafted but not sent, WhatsApp failed", days: 8 }]),

  // Quiet both sides ~16 days, no concern — pure coverage case.
  sale("9 Beaconsfield Road", "Hatfield", "AL10 8XR", 33_5000_00, "Searches",
    side("vendor", "Terence Ample", [c("email", "out", "opened", 16, { subject: "Searches ordered" })]),
    side("purchaser", "Fiona McBride", [c("email", "out", "delivered", 17, { subject: "Your purchase update" })]),
    []),

  // Recently replied both — awaiting nothing, healthy.
  sale("31 Marshalswick Lane", "St Albans", "AL1 4XE", 58_0000_00, "Enquiries",
    side("vendor", "Owen & Rhiannon Price", [c("email", "in", "replied", 0.6, { preview: "Signed and returned" })], { touchedThisWeek: true }),
    side("purchaser", "Zara Haddad", [c("whatsapp", "in", "replied", 0.9, { preview: "Thank you!" })], { touchedThisWeek: true }),
    []),

  // Parked both sides (chain holiday) — fully covered, should sink.
  sale("4 Hillside Crescent", "Potters Bar", "EN6 1EA", 40_0000_00, "On hold",
    side("vendor", "The Marsden Trust", [c("email", "out", "sent", 14, { subject: "We'll pick this up after the chain reforms" })], { parked: true }),
    side("purchaser", "Marcus Trent", [], { parked: true }),
    []),

  // Overdue search + awaiting reply vendor.
  sale("76 London Road", "Hemel Hempstead", "HP3 9SA", 29_5000_00, "Searches",
    side("vendor", "Josephine Ark", [c("email", "out", "delivered", 5.5, { subject: "Can you confirm the boundary?" })]),
    side("purchaser", "Liam O'Connor", [c("call", "out", "called", 3, { preview: "All on track for them" })], { touchedThisWeek: true }),
    [{ kind: "search", tone: "warn", title: "Searches outstanding 19 days", detail: "Water search back, local still pending", days: 19 }]),

  // Bounced + never-contacted pair (messy new file).
  sale("11 Cannon Mill Avenue", "Chesham", "HP5 2JX", 35_0000_00, "Instructed",
    side("vendor", "Rupert Danforth", [c("email", "out", "bounced", 2.8, { subject: "Welcome to your sale" })]),
    side("purchaser", "Naomi Adeyinka", []),
    []),

  // Healthy, single quiet side (vendor 12d — just under threshold).
  sale("20 Grove Road", "Harpenden", "AL5 1EA", 51_0000_00, "Enquiries",
    side("vendor", "Edmund Clarke", [c("email", "out", "opened", 12, { subject: "Enquiries coming along" })]),
    side("purchaser", "Priyanka Mehta", [c("email", "out", "replied", 2.4, { subject: "Survey report in" })], { touchedThisWeek: true }),
    []),
];

// ── relative time ────────────────────────────────────────────────────────────
export function rel(daysAgo: number): string {
  if (daysAgo < 0.04) return "just now";
  if (daysAgo < 1) return `${Math.max(1, Math.round(daysAgo * 24))}h`;
  if (daysAgo < 2) return "yesterday";
  if (daysAgo < 14) return `${Math.round(daysAgo)}d`;
  if (daysAgo < 56) return `${Math.round(daysAgo / 7)}w`;
  return `${Math.round(daysAgo / 30)}mo`;
}
export function relLong(daysAgo: number): string {
  if (daysAgo < 0.04) return "just now";
  if (daysAgo < 1) return `${Math.max(1, Math.round(daysAgo * 24))} hours ago`;
  if (daysAgo < 2) return "yesterday";
  if (daysAgo < 14) return `${Math.round(daysAgo)} days ago`;
  if (daysAgo < 56) return `${Math.round(daysAgo / 7)} weeks ago`;
  return `${Math.round(daysAgo / 30)} months ago`;
}
export function price(pence: number | null): string {
  return pence == null ? "Price TBC" : `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

// ── per-side derivations ─────────────────────────────────────────────────────
const HUMAN = (m: Comm) => !m.automated;
const OUTREACH = (m: Comm) => m.dir === "out" && m.channel !== "call" && !m.automated; // email/WA out
const INBOUND = (m: Comm) => m.dir === "in";

export type SideSignal = {
  lastHumanDays: number | null;     // days since last human contact either direction
  quiet: boolean;                   // ≥14d or never (human)
  quietDays: number | null;
  awaitingReply: boolean;           // outbound outreach newer than inbound, ≥2d old
  awaitingDays: number | null;
  bounced: boolean;                 // most-recent outbound failed/bounced
  mostRecent: Comm | null;          // any channel, for the headline chip
};

export function sideSignal(s: Side | null): SideSignal {
  if (!s) return { lastHumanDays: null, quiet: false, quietDays: null, awaitingReply: false, awaitingDays: null, bounced: false, mostRecent: null };
  const human = s.comms.filter(HUMAN);
  const lastHuman = human.length ? Math.min(...human.map((m) => m.daysAgo)) : null;
  const lastOutreach = s.comms.filter(OUTREACH);
  const lastIn = s.comms.filter(INBOUND);
  const outD = lastOutreach.length ? Math.min(...lastOutreach.map((m) => m.daysAgo)) : null;
  const inD = lastIn.length ? Math.min(...lastIn.map((m) => m.daysAgo)) : null;
  const awaiting = outD != null && (inD == null || outD < inD) && outD >= 2; // sent, no reply since, ≥2d
  const mostRecent = s.comms.length ? s.comms.reduce((a, b) => (a.daysAgo <= b.daysAgo ? a : b)) : null;
  const lastOut = s.comms.filter((m) => m.dir === "out").sort((a, b) => a.daysAgo - b.daysAgo)[0];
  return {
    lastHumanDays: lastHuman,
    quiet: lastHuman == null || lastHuman >= 14,
    quietDays: lastHuman == null ? null : Math.round(lastHuman),
    awaitingReply: awaiting,
    awaitingDays: awaiting ? Math.round(outD!) : null,
    bounced: !!lastOut && (lastOut.state === "bounced" || lastOut.state === "failed"),
    mostRecent,
  };
}

export const sideCovered = (s: Side | null) => !!s && (s.touchedThisWeek || s.parked);

// ── attention score (INVENTED prioritisation for the prototype) ──────────────
// Combines the sale's enquiry/search concerns with each side's quiet / awaiting /
// bounced signals into one 0–300ish score. The single highest-weighted signal
// becomes the row's one-line reason.
export type Reason = { tone: Tone; text: string; weight: number };

export function reasons(sale: Sale): Reason[] {
  const out: Reason[] = [];
  for (const con of sale.concerns) {
    const w = con.kind === "enquiry"
      ? (con.title.includes("stalled") ? 100 : con.title.includes("escalating") ? 82 : 60)
      : (con.days >= 21 ? 72 : con.days >= 14 ? 50 : 34);
    out.push({ tone: con.tone, text: con.title, weight: w });
  }
  for (const s of [sale.vendor, sale.purchaser]) {
    const sig = sideSignal(s);
    if (!s) continue;
    const who = s.kind === "vendor" ? "Seller" : "Buyer";
    if (sig.bounced) out.push({ tone: "danger", text: `${who}'s last message bounced`, weight: 64 });
    if (sig.quiet && !s.parked) out.push({ tone: sig.quietDays && sig.quietDays >= 21 ? "danger" : "warn", text: sig.lastHumanDays == null ? `${who} never contacted` : `${who} quiet ${sig.quietDays}d`, weight: sig.quietDays == null ? 48 : sig.quietDays >= 21 ? 46 : 30 });
    if (sig.awaitingReply) out.push({ tone: "info", text: `${who} awaiting reply · ${sig.awaitingDays}d`, weight: 22 + Math.min(14, sig.awaitingDays ?? 0) });
  }
  return out.sort((a, b) => b.weight - a.weight);
}
export function attentionScore(sale: Sale): number {
  return reasons(sale).reduce((sum, r) => sum + r.weight, 0);
}
export function topReason(sale: Sale): Reason | null {
  return reasons(sale)[0] ?? null;
}
