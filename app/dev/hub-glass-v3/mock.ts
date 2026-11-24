// /dev/hub-glass-v3 — MOCK DATA ONLY. Mirrors the real Hub's shapes
// (lib/services/hub.ts) so the redesign preserves every datum without touching
// production. Fictional samples, confined to this dev-only file.
//
// Strings here are STRICTLY grounded: dates, counts, days-since, who's assigned,
// stage. Nothing infers a cause or an activity the system couldn't verify.

export type Urgency = "escalated" | "overdue" | "today" | "week";
export type WorkCategory =
  | "reminder" | "at_risk" | "booking" | "mortgage" | "filing" | "review" | "quiet" | "enquiry" | "exchange_passed";
export type ActionKind = "chase" | "email" | "confirm_date" | "assign" | "nav" | "toast";

export type WorkAction = { label: string; danger?: boolean; kind?: ActionKind };
export type WorkItem = {
  id: string; category: WorkCategory; urgency: Urgency;
  propertyId: string; address: string; town: string;
  stage: string;                 // which pipeline stage the file sits in (data)
  assignee: string;              // who's handling it (data) — "You" | name
  title: string;                 // the need, short — index + focus heading
  fact: string;                  // grounded secondary fact (date / count / days)
  indexNote: string;             // the one-line descriptor shown in the index
  primary: WorkAction;           // the main action (opens drawer / modal / nav)
  menu: WorkAction[];            // overflow actions (exact existing set)
};

export type DiaryItem = { id: string; type: "exchange" | "completion"; address: string; status: "done" | "ready" | "not_ready" };
export type Stage = { key: string; label: string; count: number; files: string[] };
export type WeekBucket = { label: string; count: number; feesK: number; current?: boolean; files: { address: string; feeK: number }[] };
export type Activity = { id: string; kind: "comm" | "milestone"; text: string; context: string; at: string };

export type HubData = {
  diary: DiaryItem[];
  work: WorkItem[];
  pipeline: {
    activeFiles: number; exchangingSoon: number; needsAttention: number; escalated: number;
    pipelineValueM: number; feesK: number; newThisMonth: number;
    medianDays: number; within12Pct: number; exchLast30: number; momentumPct: number; spark: number[];
    stages: Stage[];
  };
  wins: { exchanges: number; completions: number; fastestDays: number; biggestFeeK: number; newBusiness: number };
  forecast: WeekBucket[];
  activity: Activity[];
};

export const CATEGORY_LABEL: Record<WorkCategory, string> = {
  reminder: "Reminder", at_risk: "At risk", booking: "Booking", mortgage: "Mortgage",
  filing: "Filing", review: "Review", quiet: "Gone quiet", enquiry: "Enquiry", exchange_passed: "Exchange passed",
};
// Urgency precedence mirrors the real Hub (escalated → overdue → due-today → this week).
export const URGENCY: Record<Urgency, { label: string; tone: "danger" | "warn" | "accent" | "neutral"; rank: number }> = {
  escalated: { label: "Escalated", tone: "danger", rank: 0 },
  overdue: { label: "Overdue", tone: "warn", rank: 1 },
  today: { label: "Due today", tone: "accent", rank: 2 },
  week: { label: "This week", tone: "neutral", rank: 3 },
};

const chase = (label: string): WorkAction => ({ label, kind: "chase" });

export const HUB: HubData = {
  diary: [
    { id: "d1", type: "exchange", address: "7 Victoria Road, Ware", status: "ready" },
    { id: "d2", type: "completion", address: "22 Nathaniels Walk, Harlow", status: "not_ready" },
  ],
  work: [
    {
      id: "w1", category: "exchange_passed", urgency: "escalated", propertyId: "maple",
      address: "3 Maple Court", town: "Hertford", stage: "Moving", assignee: "You",
      title: "Exchange date has passed", fact: "Expected 28 October — 5 days ago",
      indexNote: "exchange 5 days past",
      primary: { label: "Set a new date", kind: "confirm_date" },
      menu: [{ label: "Recalculate the estimate", kind: "confirm_date" }, { label: "Snooze a few days", kind: "toast" }],
    },
    {
      id: "w2", category: "reminder", urgency: "escalated", propertyId: "bushey",
      address: "14 Bushey Avenue", town: "Broxbourne", stage: "Legal work", assignee: "Priya",
      title: "Chase the buyer's solicitor", fact: "Escalated by Priya · 3 chases, no reply",
      indexNote: "buyer's solicitor, 3 chases",
      primary: chase("Chase"),
      menu: [chase("Mark as chased"), { label: "Confirm step done", kind: "confirm_date" }, { label: "Snooze until tomorrow", kind: "toast" }, { label: "Snooze for a week", kind: "toast" }],
    },
    {
      id: "w2b", category: "enquiry", urgency: "week", propertyId: "bushey",
      address: "14 Bushey Avenue", town: "Broxbourne", stage: "Legal work", assignee: "Priya",
      title: "Enquiry open with no reply", fact: "With Duggan & Co · 23 days",
      indexNote: "enquiry, 23 days",
      primary: chase("Chase solicitor"),
      menu: [{ label: "Open the file", kind: "nav" }],
    },
    {
      id: "w3", category: "at_risk", urgency: "overdue", propertyId: "kingfisher",
      address: "9 Kingfisher Drive", town: "Bishop's Stortford", stage: "Nearly there", assignee: "Sam",
      title: "Ready to exchange, no movement", fact: "No step advanced for 11 days",
      indexNote: "ready, no movement 11 days",
      primary: { label: "Open the file", kind: "nav" },
      menu: [{ label: "Dismiss for 2 weeks", kind: "toast" }],
    },
    {
      id: "w4", category: "reminder", urgency: "overdue", propertyId: "oak",
      address: "41 Oak Lane", town: "Hoddesdon", stage: "Moving", assignee: "You",
      title: "Send the memorandum of sale", fact: "Due 2 days ago",
      indexNote: "memo of sale, 2 days late",
      primary: chase("Chase"),
      menu: [chase("Mark as chased"), { label: "Confirm step done", kind: "confirm_date" }, { label: "Snooze until tomorrow", kind: "toast" }],
    },
    {
      id: "w5", category: "booking", urgency: "today", propertyId: "church",
      address: "2 Church Street", town: "Ware", stage: "Nearly there", assignee: "Sam",
      title: "Confirm the buyer's survey booking", fact: "Booked for tomorrow, 2pm",
      indexNote: "survey booking to confirm",
      primary: { label: "Confirm", kind: "toast" },
      menu: [{ label: "Desktop valuation", kind: "toast" }, { label: "Log it, don't email", kind: "toast" }, { label: "Not a real booking", kind: "toast", danger: true }],
    },
    {
      id: "w6", category: "mortgage", urgency: "today", propertyId: "riverside",
      address: "18 Riverside", town: "Hertford", stage: "Legal work", assignee: "You",
      title: "Mortgage offer expiring", fact: "Expires in 9 days",
      indexNote: "mortgage offer, 9 days left",
      primary: { label: "Open the file", kind: "nav" },
      menu: [{ label: "Dismiss for 2 weeks", kind: "toast" }],
    },
    {
      id: "w7", category: "review", urgency: "today", propertyId: "meadow",
      address: "5 Meadow Way", town: "Harlow", stage: "Moving", assignee: "You",
      title: "Review date has arrived", fact: "On hold until today",
      indexNote: "review due today",
      primary: { label: "Take off hold", kind: "toast" },
      menu: [{ label: "Wait another week", kind: "toast" }, { label: "Pick a new date", kind: "confirm_date" }, { label: "Hold indefinitely", kind: "toast" }, { label: "Withdraw the file", kind: "toast", danger: true }],
    },
    {
      id: "w8", category: "filing", urgency: "week", propertyId: "filing",
      address: "3 emails to file", town: "From solicitors", stage: "—", assignee: "You",
      title: "Place 3 emails on a file", fact: "Oldest received 2 days ago",
      indexNote: "3 emails to file",
      primary: { label: "File all 3", kind: "toast" },
      menu: [{ label: "Dismiss", kind: "toast" }],
    },
    {
      id: "w9", category: "quiet", urgency: "week", propertyId: "elm",
      address: "63 Elm Grove", town: "Cheshunt", stage: "Legal work", assignee: "Sam",
      title: "No portal activity", fact: "No portal activity for 18 days",
      indexNote: "quiet 18 days",
      primary: { label: "Send a nudge", kind: "email" },
      menu: [{ label: "Dismiss for 2 weeks", kind: "toast" }],
    },
  ],
  pipeline: {
    activeFiles: 34, exchangingSoon: 6, needsAttention: 10, escalated: 2,
    pipelineValueM: 11.2, feesK: 48, newThisMonth: 5,
    medianDays: 71, within12Pct: 64, exchLast30: 9, momentumPct: 18, spark: [4, 6, 5, 7, 6, 8, 7, 9],
    stages: [
      { key: "just_in", label: "Just in", count: 5, files: ["9 Kingfisher Drive", "31 Lower Road", "8 Hazel Close", "12 Fore Street", "4 Mill Lane"] },
      { key: "moving", label: "Moving", count: 8, files: ["3 Maple Court", "41 Oak Lane", "5 Meadow Way", "77 High Road", "2 Baker Close", "19 Castle Street", "6 Mead Lane", "9 Star Street"] },
      { key: "legal", label: "Legal work", count: 11, files: ["14 Bushey Avenue", "18 Riverside", "63 Elm Grove", "5 Priory Gardens", "26 Kings Way", "9 Oakfield", "3 Dane Street", "40 West Road", "22 Park Avenue", "1 The Green", "15 Vine Street"] },
      { key: "nearly", label: "Nearly there", count: 4, files: ["9 Kingfisher Drive", "2 Church Street", "88 Amwell End", "33 New Road"] },
      { key: "exchanged", label: "Exchanged", count: 3, files: ["12 Queens Road", "5 Rye Street", "44 Hockerill"] },
      { key: "completed", label: "Completed", count: 3, files: ["22 Nathaniels Walk", "17 Bell Lane", "7 Monks Walk"] },
    ],
  },
  wins: { exchanges: 9, completions: 6, fastestDays: 38, biggestFeeK: 7.4, newBusiness: 5 },
  forecast: [
    { label: "This week", count: 3, feesK: 12, current: true, files: [{ address: "7 Victoria Road", feeK: 4.2 }, { address: "2 Church Street", feeK: 3.8 }, { address: "88 Amwell End", feeK: 4 }] },
    { label: "Next week", count: 2, feesK: 8, files: [{ address: "33 New Road", feeK: 3.5 }, { address: "26 Kings Way", feeK: 4.5 }] },
    { label: "In 2 weeks", count: 4, feesK: 17, files: [{ address: "14 Bushey Avenue", feeK: 5 }, { address: "5 Priory Gardens", feeK: 4 }, { address: "9 Oakfield", feeK: 4 }, { address: "40 West Road", feeK: 4 }] },
    { label: "In 3 weeks", count: 1, feesK: 4, files: [{ address: "6 Mead Lane", feeK: 4 }] },
    { label: "In 4 weeks", count: 2, feesK: 9, files: [{ address: "22 Park Avenue", feeK: 5 }, { address: "1 The Green", feeK: 4 }] },
  ],
  activity: [
    { id: "a1", kind: "milestone", text: "Enquiries raised confirmed", context: "14 Bushey Avenue", at: "18m ago" },
    { id: "a2", kind: "comm", text: "Solicitor replied to a chase", context: "3 Maple Court", at: "52m ago" },
    { id: "a3", kind: "milestone", text: "Searches received, no adverse entries", context: "7 Victoria Road", at: "2h ago" },
    { id: "a4", kind: "comm", text: "Buyer completed ID checks", context: "18 Riverside", at: "4h ago" },
    { id: "a5", kind: "milestone", text: "Mortgage offer received", context: "2 Church Street", at: "5h ago" },
    { id: "a6", kind: "comm", text: "Seller returned property forms", context: "33 New Road", at: "Yesterday" },
    { id: "a7", kind: "milestone", text: "Memorandum of sale issued", context: "41 Oak Lane", at: "Yesterday" },
    { id: "a8", kind: "comm", text: "Buyer's solicitor confirmed instruction", context: "26 Kings Way", at: "Yesterday" },
  ],
};

// ── Roles — scope, emphasis, money label, lower panel, banners ─────────────────
export type RoleKey = "director" | "negotiator" | "progressor" | "admin" | "owner";
export type RoleCfg = {
  key: RoleKey; label: string; name: string;
  canCreateSale: boolean; banners: string[];
  moneyLabel: string;            // what the pipeline-value figure means for this role
  showOwner: boolean;            // offer the owner scope filter + show assignee in focus
  scopes: string[];             // scope filter options (ownership as a control)
  businessPanel: "service" | "clients" | "none";
  emphasis: "oversight" | "own" | "execution";
};
export const ROLES: Record<RoleKey, RoleCfg> = {
  director: { key: "director", label: "Agency director", name: "Ellis", canCreateSale: true, banners: ["email"], moneyLabel: "£4.1m closing in 4 weeks", showOwner: true, scopes: ["Everyone", "Mine", "Priya's", "Sam's"], businessPanel: "service", emphasis: "oversight" },
  negotiator: { key: "negotiator", label: "Negotiator", name: "Sam", canCreateSale: true, banners: [], moneyLabel: "£1.8m closing in 4 weeks", showOwner: false, scopes: [], businessPanel: "none", emphasis: "own" },
  progressor: { key: "progressor", label: "TSP progressor", name: "Priya", canCreateSale: false, banners: [], moneyLabel: "≈ £12k our fees", showOwner: false, scopes: ["All mine", "Harpers", "Weston"], businessPanel: "none", emphasis: "execution" },
  admin: { key: "admin", label: "Admin (platform)", name: "Alex", canCreateSale: true, banners: [], moneyLabel: "≈ £48k our fees", showOwner: true, scopes: ["Platform", "Mine"], businessPanel: "service", emphasis: "oversight" },
  owner: { key: "owner", label: "Business owner", name: "Jordan", canCreateSale: true, banners: ["card"], moneyLabel: "£3.3m · £19k fees", showOwner: true, scopes: ["All clients", "Harpers", "Weston"], businessPanel: "clients", emphasis: "oversight" },
};

export const CLIENTS = [
  { name: "Harpers Estates", active: 12, pipelineM: 4.1, feeK: 7.2 },
  { name: "Weston & Co", active: 8, pipelineM: 2.6, feeK: 4.8 },
  { name: "Bridge Property", active: 5, pipelineM: 1.9, feeK: 0, feeUnset: true },
];

// ── Derived: group work by property (single-need = row, multi-need = situation) ─
export type PropertyGroup = { propertyId: string; address: string; town: string; items: WorkItem[]; topRank: number; topUrgency: Urgency };
export function groupByProperty(work: WorkItem[]): PropertyGroup[] {
  const map = new Map<string, WorkItem[]>();
  for (const w of work) { const a = map.get(w.propertyId) ?? []; a.push(w); map.set(w.propertyId, a); }
  const groups: PropertyGroup[] = [];
  for (const [propertyId, items] of map) {
    const sorted = [...items].sort((a, b) => URGENCY[a.urgency].rank - URGENCY[b.urgency].rank);
    const top = sorted[0];
    groups.push({ propertyId, address: top.address, town: top.town, items: sorted, topRank: URGENCY[top.urgency].rank, topUrgency: top.urgency });
  }
  return groups.sort((a, b) => a.topRank - b.topRank);
}
