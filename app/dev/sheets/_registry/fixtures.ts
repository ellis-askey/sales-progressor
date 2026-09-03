// Shared fixture data for the /dev/sheets inspection harness.
//
// Deliberately weighted toward EDGE CASES — very long addresses, long names,
// long firm names, long emails, many contacts, long notes — so the harness
// reveals layout weaknesses rather than only flattering tidy short data.
// Entries import what they need and shape it to each component's prop types.
//
// Nothing here is real. IDs are "demo-*" so any server action that does escape
// a fixture handler hits a non-existent record and no-ops rather than mutating
// a live file. This page is also dev-only (blocked in production).

export const DEMO_TX_ID = "demo-transaction-0000";

// ── Addresses ──────────────────────────────────────────────────────────────
export const SHORT_ADDRESS = "12 Mill Lane, Leeds";
export const ADDRESS = "14 Oakwood Avenue, Kingston upon Thames";
export const LONG_ADDRESS =
  "Flat 27b, The Old Chocolate Factory, 118-124 Cranbrook Road, Bishopston, Bristol, BS7 8BN";

// ── People names ─────────────────────────────────────────────────────────────
export const SHORT_NAME = "Sam Rai";
export const NAME = "Priya Chandrasekaran";
export const LONG_NAME = "Alexander Featherstonehaugh-Cholmondeley III";

// ── Firms ────────────────────────────────────────────────────────────────────
export const FIRM = "Carter & Wells Solicitors";
export const LONG_FIRM =
  "Featherstonehaugh, Cholmondeley, Marjoribanks & Worthington-Smythe LLP (Conveyancing Division)";

// ── Emails ───────────────────────────────────────────────────────────────────
export const EMAIL = "priya@carterwells.co.uk";
export const LONG_EMAIL =
  "alexander.featherstonehaugh-cholmondeley@conveyancing-department.worthington-smythe-llp.co.uk";

// ── Long copy ────────────────────────────────────────────────────────────────
export const LONG_NOTE =
  "Vendor is currently abroad until the 14th and can only be reached by email in the evenings. " +
  "Buyer's mortgage offer expires at the end of next month, so we need searches back before then. " +
  "There is an ongoing boundary query with the neighbour at number 16 which the seller's solicitor " +
  "is aware of but has not yet formally responded to. The chain above is proceeding but the top buyer " +
  "has not yet had their survey booked. Please chase the management company for the leasehold pack — " +
  "this has been outstanding for three weeks and is now the critical path item on this file.";

export const SHORT_NOTE = "Buyer keen to exchange before month end.";

// ── Generic contacts (widely-shaped so entries can map to their own types) ───
export type DemoContact = {
  id: string;
  name: string;
  roleType: string;
  email: string | null;
  phone: string | null;
  side: "vendor" | "purchaser" | null;
  secondaryEmail: string | null;
  firmName: string | null;
};

export const CONTACTS: DemoContact[] = [
  { id: "c-vendor", name: NAME, roleType: "vendor", email: "priya.c@gmail.com", phone: "07700 900111", side: "vendor", secondaryEmail: null, firmName: null },
  { id: "c-purchaser", name: "Tom & Rebecca Whitfield", roleType: "purchaser", email: "t.whitfield@example.com", phone: "07700 900222", side: "purchaser", secondaryEmail: null, firmName: null },
  { id: "c-vendor-sol", name: "Margaret Osei-Bonsu", roleType: "vendor_solicitor", email: EMAIL, phone: "0113 496 0000", side: "vendor", secondaryEmail: "assistant@carterwells.co.uk", firmName: FIRM },
  { id: "c-purchaser-sol", name: LONG_NAME, roleType: "purchaser_solicitor", email: LONG_EMAIL, phone: "020 7946 0000", side: "purchaser", secondaryEmail: null, firmName: LONG_FIRM },
  { id: "c-broker", name: "Daniel Fitzgerald", roleType: "mortgage_broker", email: "dan@brightfuturemortgages.co.uk", phone: "07700 900333", side: "purchaser", secondaryEmail: null, firmName: "Bright Future Mortgages" },
];

export const CONTACTS_SINGLE: DemoContact[] = [CONTACTS[0]];

// A price in pence and pounds for money-driven components.
export const PRICE_GBP = 475000;
export const PRICE_PENCE = 47500000;

// ISO dates (fixed, since Date.now() is unavailable in some harness contexts —
// use literals so previews are deterministic).
export const DATE_TODAY = "2026-09-03";
export const DATE_SOON = "2026-09-17";
export const DATE_PAST = "2026-08-20";

// A no-op for handlers that would otherwise mutate. Prefer wiring to onClose
// where a close is the natural result; use this for "stay open" actions.
export const noop = () => {};
