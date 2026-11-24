// /dev/hub-glass-v2 — MOCK DATA ONLY. Mirrors the real Hub's shapes
// (lib/services/hub.ts) so the redesign preserves every datum, without touching
// production. Fictional samples, confined to this dev-only file.
//
// v2 extends the v1 mock shapes with the data the approved ideas need to be shown:
//   · work items carry a `propertyId` so multiple needs on the SAME property can be
//     grouped into one situation (approved: property-based grouping).
//   · pipeline stages carry `files` so hovering a stage can reveal the sales behind
//     the number (approved: connect pipeline information to its properties).
//   · forecast weeks carry `files` so a week can reveal what's exchanging then.
// None of this changes production behaviour — it is demonstration data only.

export type Urgency = "escalated" | "overdue" | "today" | "week";
export type WorkCategory =
  | "reminder" | "at_risk" | "booking" | "mortgage" | "filing" | "review" | "quiet" | "enquiry" | "exchange_passed";

export type WorkAction = { label: string; primary?: boolean; danger?: boolean; menu?: string[]; kind?: ActionKind };
// how an action is DEMONSTRATED in the prototype — a drawer, a modal, a nav, or a
// plain simulated write (toast). Mirrors what the real Hub action opens/does.
export type ActionKind = "chase" | "confirm_date" | "email" | "nav" | "toast";

export type WorkItem = {
  id: string; category: WorkCategory; urgency: Urgency;
  propertyId: string;      // files that share this belong to the same property
  address: string; town: string;
  need: string;            // what's needed, in plain English
  meta?: string;           // secondary detail
  owner?: string;          // who's handling it (director view surfaces this)
  actions: WorkAction[];   // inline actions (simulated)
};

export type DiaryItem = { id: string; type: "exchange" | "completion"; address: string; status: "done" | "ready" | "not_ready" };

export type Stage = { key: string; label: string; count: number; files: string[] };
export type WeekBucket = { label: string; count: number; feesK: number; current?: boolean; files: { address: string; feeK: number }[] };
export type Activity = { id: string; kind: "comm" | "milestone"; description: string; context: string; at: string };

export type HubData = {
  diary: DiaryItem[];
  work: WorkItem[];
  pipeline: {
    activeFiles: number; exchangingSoon: number; needsAttention: number; escalated: number;
    pipelineValueM: number; feesK: number; newThisMonth: number;
    medianDays: number | null; within12Pct: number | null; exchLast30: number; momentumPct: number; spark: number[];
    stages: Stage[];
  };
  wins: { exchanges: number; fastestDays: number; biggestFeeK: number; completions: number; newBusiness: number };
  forecast: WeekBucket[];
  activity: Activity[];
};

export const CATEGORY_META: Record<WorkCategory, { label: string; tone: "danger" | "warn" | "accent" | "neutral" }> = {
  reminder: { label: "Reminder", tone: "accent" },
  at_risk: { label: "At risk", tone: "danger" },
  booking: { label: "Booking", tone: "warn" },
  mortgage: { label: "Mortgage", tone: "warn" },
  filing: { label: "Filing", tone: "neutral" },
  review: { label: "Review", tone: "accent" },
  quiet: { label: "Gone quiet", tone: "neutral" },
  enquiry: { label: "Enquiry", tone: "neutral" },
  exchange_passed: { label: "Exchange passed", tone: "danger" },
};
// Ordering mirrors the real Hub's urgency precedence (escalated first, then overdue,
// then due-today, then this-week). The prototype reuses this order; it does not
// invent a new "most important" rule.
export const URGENCY_META: Record<Urgency, { label: string; tone: "danger" | "warn" | "accent"; rank: number }> = {
  escalated: { label: "Escalated", tone: "danger", rank: 0 },
  overdue: { label: "Overdue", tone: "warn", rank: 1 },
  today: { label: "Due today", tone: "accent", rank: 2 },
  week: { label: "This week", tone: "accent", rank: 3 },
};

const A = (label: string, o: Partial<WorkAction> = {}): WorkAction => ({ label, ...o });

export const HUB: HubData = {
  diary: [
    { id: "d1", type: "exchange", address: "7 Victoria Road, Ware", status: "ready" },
    { id: "d2", type: "completion", address: "22 Nathaniels Walk, Harlow", status: "not_ready" },
  ],
  work: [
    { id: "w1", category: "exchange_passed", urgency: "escalated", propertyId: "maple", address: "3 Maple Court", town: "Hertford, SG14 1QF", need: "Exchange date has passed", meta: "Expected 28 Oct · 5 days ago", owner: "You",
      actions: [A("Deal with it", { primary: true, kind: "confirm_date", menu: ["Set a new date", "Recalculate estimate", "Snooze while I chase"] })] },
    { id: "w2", category: "reminder", urgency: "escalated", propertyId: "bushey", address: "14 Bushey Avenue", town: "Broxbourne, EN10 6QE", need: "Chase the buyer's solicitor for enquiry replies", meta: "Escalated by Priya · 3 chases, no reply", owner: "Priya",
      actions: [A("Chase", { primary: true, kind: "chase", menu: ["Mark as chased", "Confirm step done", "Snooze to tomorrow", "Snooze a week"] })] },
    { id: "w2b", category: "enquiry", urgency: "week", propertyId: "bushey", address: "14 Bushey Avenue", town: "Broxbourne, EN10 6QE", need: "Enquiry loop silent for 3+ weeks", meta: "With Duggan & Co · quiet 23 days", owner: "Priya",
      actions: [A("Chase solicitor", { primary: true, kind: "chase" })] },
    { id: "w3", category: "at_risk", urgency: "overdue", propertyId: "kingfisher", address: "9 Kingfisher Drive", town: "Bishop's Stortford, CM23 4LP", need: "Ready to exchange, but frozen", meta: "Nothing has moved in 11 days", owner: "Sam",
      actions: [A("Open file", { primary: true, kind: "nav" }), A("Dismiss", { kind: "toast", menu: ["Dismiss for 2 weeks"] })] },
    { id: "w4", category: "reminder", urgency: "overdue", propertyId: "oak", address: "41 Oak Lane", town: "Hoddesdon, EN11 8RT", need: "Send the memorandum of sale", meta: "Due 2 days ago", owner: "You",
      actions: [A("Chase", { primary: true, kind: "chase", menu: ["Mark as chased", "Confirm step done", "Snooze to tomorrow"] })] },
    { id: "w5", category: "booking", urgency: "today", propertyId: "church", address: "2 Church Street", town: "Ware, SG12 9EN", need: "Confirm the buyer's survey booking", meta: "Booked for tomorrow, 2pm", owner: "Sam",
      actions: [A("Confirm", { primary: true, kind: "toast", menu: ["Desktop valuation", "Log it", "Not a real booking"] })] },
    { id: "w6", category: "mortgage", urgency: "today", propertyId: "riverside", address: "18 Riverside", town: "Hertford, SG14 1RX", need: "Buyer's mortgage offer expires soon", meta: "Expires in 9 days", owner: "You",
      actions: [A("Open file", { primary: true, kind: "nav" }), A("Dismiss", { kind: "toast", menu: ["Dismiss for 2 weeks"] })] },
    { id: "w7", category: "review", urgency: "today", propertyId: "meadow", address: "5 Meadow Way", town: "Harlow, CM20 2EP", need: "Return date arrived — decide the next move", meta: "On hold until today", owner: "You",
      actions: [A("Decide", { primary: true, kind: "toast", menu: ["Take off hold", "Done — resume", "Wait on it", "Pick a date", "Withdraw"] })] },
    { id: "w8", category: "filing", urgency: "week", propertyId: "filing", address: "3 emails to file", town: "From solicitors", need: "Place 3 emails on a file", meta: "Oldest 2 days ago", owner: "You",
      actions: [A("File all 3", { primary: true, kind: "toast" }), A("Dismiss", { kind: "toast" })] },
    { id: "w9", category: "quiet", urgency: "week", propertyId: "elm", address: "63 Elm Grove", town: "Cheshunt, EN8 9AS", need: "Client has gone quiet", meta: "No portal activity for 18 days", owner: "Sam",
      actions: [A("Send a nudge", { primary: true, kind: "email" }), A("Dismiss", { kind: "toast", menu: ["Dismiss for 2 weeks"] })] },
  ],
  pipeline: {
    activeFiles: 34, exchangingSoon: 6, needsAttention: 10, escalated: 2,
    pipelineValueM: 11.2, feesK: 48, newThisMonth: 5,
    medianDays: 71, within12Pct: 64, exchLast30: 9, momentumPct: 18, spark: [4, 6, 5, 7, 6, 8, 7, 9],
    stages: [
      { key: "just_in", label: "Just in", count: 5, files: ["9 Kingfisher Drive", "31 Lower Road", "8 Hazel Close", "12 Fore Street", "4 Mill Lane"] },
      { key: "moving", label: "Moving", count: 8, files: ["3 Maple Court", "41 Oak Lane", "18 Riverside", "63 Elm Grove", "5 Meadow Way", "77 High Road", "2 Baker Close", "19 Castle St"] },
      { key: "legal", label: "Legal work", count: 11, files: ["14 Bushey Avenue", "11 Station Road", "5 Priory Gardens", "26 Kings Way", "9 Oakfield", "3 Dane St", "40 West Rd", "6 Mead Ln", "22 Park Ave", "1 The Green", "15 Vine St"] },
      { key: "nearly", label: "Nearly there", count: 4, files: ["7 Victoria Road", "2 Church Street", "88 Amwell End", "33 New Road"] },
      { key: "exchanged", label: "Exchanged", count: 3, files: ["12 Queens Rd", "5 Rye St", "44 Hockerill"] },
      { key: "completed", label: "Completed", count: 3, files: ["22 Nathaniels Walk", "9 Star St", "17 Bell Ln"] },
    ],
  },
  wins: { exchanges: 9, fastestDays: 38, biggestFeeK: 7.4, completions: 6, newBusiness: 5 },
  forecast: [
    { label: "This week", count: 3, feesK: 12, current: true, files: [{ address: "7 Victoria Road", feeK: 4.2 }, { address: "2 Church Street", feeK: 3.8 }, { address: "88 Amwell End", feeK: 4 }] },
    { label: "Next week", count: 2, feesK: 8, files: [{ address: "33 New Road", feeK: 3.5 }, { address: "26 Kings Way", feeK: 4.5 }] },
    { label: "In 2 wks", count: 4, feesK: 17, files: [{ address: "14 Bushey Avenue", feeK: 5 }, { address: "5 Priory Gardens", feeK: 4 }, { address: "9 Oakfield", feeK: 4 }, { address: "40 West Rd", feeK: 4 }] },
    { label: "In 3 wks", count: 1, feesK: 4, files: [{ address: "6 Mead Ln", feeK: 4 }] },
    { label: "In 4 wks", count: 2, feesK: 9, files: [{ address: "22 Park Ave", feeK: 5 }, { address: "1 The Green", feeK: 4 }] },
  ],
  activity: [
    { id: "a1", kind: "milestone", description: "You confirmed enquiries raised", context: "14 Bushey Avenue", at: "18m ago" },
    { id: "a2", kind: "comm", description: "Solicitor replied to our chase", context: "3 Maple Court", at: "52m ago" },
    { id: "a3", kind: "milestone", description: "Searches received, no adverse entries", context: "7 Victoria Road", at: "2h ago" },
    { id: "a4", kind: "comm", description: "Buyer completed ID checks", context: "18 Riverside", at: "4h ago" },
    { id: "a5", kind: "milestone", description: "Memorandum of sale issued", context: "41 Oak Lane", at: "Yesterday" },
  ],
};

// ── Roles — drives scope, emphasis, money label, lower panel, banners ──────────
// Mirrors the real Hub's role branching (resolveInternalVisibility /
// resolveAgentVisibility). Scope words are illustrative of the existing rules, not
// new permissions.
export type RoleKey = "director" | "negotiator" | "progressor" | "admin" | "owner";
export type RoleCfg = {
  key: RoleKey; label: string; name: string;
  scopeWord: string;          // "across the agency" | "your sales" | "your assigned files"
  subtitle: string;
  canCreateSale: boolean; banners: string[];
  lowerPanel: "service" | "clients" | "none";
  moneyLabel: string;         // what the pipeline-value figure means for this role
  showOwner: boolean;         // surface who's handling each item (oversight roles)
  emphasis: "oversight" | "own" | "execution"; // tilts the layout weighting
};
export const ROLES: Record<RoleKey, RoleCfg> = {
  director: { key: "director", label: "Agency director", name: "Ellis", scopeWord: "across the agency", subtitle: "Here's how the agency is moving today.", canCreateSale: true, banners: ["email"], lowerPanel: "service", moneyLabel: "£4.1m closing in 4 weeks", showOwner: true, emphasis: "oversight" },
  negotiator: { key: "negotiator", label: "Negotiator", name: "Sam", scopeWord: "your sales", subtitle: "Here's where your sales stand today.", canCreateSale: true, banners: [], lowerPanel: "none", moneyLabel: "£1.8m closing in 4 weeks", showOwner: false, emphasis: "own" },
  progressor: { key: "progressor", label: "TSP progressor", name: "Priya", scopeWord: "your assigned files", subtitle: "Here's what your files need today.", canCreateSale: false, banners: [], lowerPanel: "none", moneyLabel: "≈ £12k our fees", showOwner: false, emphasis: "execution" },
  admin: { key: "admin", label: "Admin (platform)", name: "Alex", scopeWord: "across the platform", subtitle: "Here's how the platform is moving today.", canCreateSale: true, banners: [], lowerPanel: "service", moneyLabel: "≈ £48k our fees", showOwner: true, emphasis: "oversight" },
  owner: { key: "owner", label: "Business owner", name: "Jordan", scopeWord: "across your clients", subtitle: "Here's how your clients are moving today.", canCreateSale: true, banners: ["card"], lowerPanel: "clients", moneyLabel: "£3.3m · £19k fees", showOwner: true, emphasis: "oversight" },
};

export const CLIENTS = [
  { name: "Harpers Estates", active: 12, pipelineM: 4.1, feeK: 7.2 },
  { name: "Weston & Co", active: 8, pipelineM: 2.6, feeK: 4.8 },
  { name: "Bridge Property", active: 5, pipelineM: 1.9, feeK: 0, feeUnset: true },
];

// ── Derived: group work items by property ──────────────────────────────────────
// Property-based grouping (approved for demonstration). A property with more than
// one open need becomes a single "situation"; single-need properties stay as one
// row. Within a group, the most urgent item leads (existing urgency order).
export type PropertyGroup = {
  propertyId: string; address: string; town: string;
  items: WorkItem[];
  topRank: number;        // best (lowest) urgency rank in the group, for ordering
  topUrgency: Urgency;
};
export function groupByProperty(work: WorkItem[]): PropertyGroup[] {
  const map = new Map<string, WorkItem[]>();
  for (const w of work) {
    const arr = map.get(w.propertyId) ?? [];
    arr.push(w);
    map.set(w.propertyId, arr);
  }
  const groups: PropertyGroup[] = [];
  for (const [propertyId, items] of map) {
    const sorted = [...items].sort((a, b) => URGENCY_META[a.urgency].rank - URGENCY_META[b.urgency].rank);
    const top = sorted[0];
    groups.push({ propertyId, address: top.address, town: top.town, items: sorted, topRank: URGENCY_META[top.urgency].rank, topUrgency: top.urgency });
  }
  // order groups by their most-urgent item, exactly as the real Hub ranks work
  return groups.sort((a, b) => a.topRank - b.topRank);
}
