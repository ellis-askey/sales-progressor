// /dev/hub-glass — MOCK DATA ONLY. Mirrors the real Hub's shapes (lib/services/hub.ts)
// so the redesign preserves every datum, without touching production. Fictional samples,
// confined to this dev-only file.

export type Urgency = "escalated" | "overdue" | "today" | "week";
export type WorkCategory =
  | "reminder" | "at_risk" | "booking" | "mortgage" | "filing" | "review" | "quiet" | "enquiry" | "exchange_passed";

export type WorkAction = { label: string; primary?: boolean; danger?: boolean; menu?: string[] };
export type WorkItem = {
  id: string; category: WorkCategory; urgency: Urgency;
  address: string; town: string;
  need: string;            // what's needed, in plain English
  meta?: string;           // secondary detail
  actions: WorkAction[];   // inline actions (simulated)
};

export type DiaryItem = { id: string; type: "exchange" | "completion"; address: string; status: "done" | "ready" | "not_ready" };

export type Stage = { key: string; label: string; count: number; sample?: string };
export type WeekBucket = { label: string; count: number; feesK: number; current?: boolean };
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
  reminder: { label: "Reminders", tone: "accent" },
  at_risk: { label: "At risk", tone: "danger" },
  booking: { label: "Bookings", tone: "warn" },
  mortgage: { label: "Mortgage", tone: "warn" },
  filing: { label: "Filing", tone: "neutral" },
  review: { label: "Reviews", tone: "accent" },
  quiet: { label: "Gone quiet", tone: "neutral" },
  enquiry: { label: "Enquiries", tone: "neutral" },
  exchange_passed: { label: "Exchange passed", tone: "danger" },
};
export const URGENCY_META: Record<Urgency, { label: string; tone: "danger" | "warn" | "accent" }> = {
  escalated: { label: "Escalated", tone: "danger" },
  overdue: { label: "Overdue", tone: "warn" },
  today: { label: "Due today", tone: "accent" },
  week: { label: "This week", tone: "accent" },
};

const A = (label: string, o: Partial<WorkAction> = {}): WorkAction => ({ label, ...o });

export const HUB: HubData = {
  diary: [
    { id: "d1", type: "exchange", address: "7 Victoria Road, Ware", status: "ready" },
    { id: "d2", type: "completion", address: "22 Nathaniels Walk, Harlow", status: "not_ready" },
  ],
  work: [
    { id: "w1", category: "exchange_passed", urgency: "escalated", address: "3 Maple Court", town: "Hertford, SG14 1QF", need: "Exchange date passed", meta: "Expected 28 Oct · 5 days past", actions: [A("Deal with it", { primary: true, menu: ["Set a new date", "Recalculate estimate", "Snooze while I chase"] })] },
    { id: "w2", category: "reminder", urgency: "escalated", address: "14 Bushey Avenue", town: "Broxbourne, EN10 6QE", need: "Chase the buyer's solicitor for enquiry replies", meta: "Escalated by Priya · 3 chases, no reply", actions: [A("Chase", { primary: true, menu: ["Mark as chased", "Confirm step done", "Snooze to tomorrow", "Snooze a week"] })] },
    { id: "w3", category: "at_risk", urgency: "overdue", address: "9 Kingfisher Drive", town: "Bishop's Stortford, CM23 4LP", need: "Ready but frozen", meta: "Ready to exchange since 19 Oct. Nothing has moved in 11 days.", actions: [A("Open file", { primary: true }), A("Dismiss", { menu: ["Dismiss for 2 weeks"] })] },
    { id: "w4", category: "reminder", urgency: "overdue", address: "41 Oak Lane", town: "Hoddesdon, EN11 8RT", need: "Send the memorandum of sale", meta: "Due 2 days ago", actions: [A("Chase", { primary: true, menu: ["Mark as chased", "Confirm step done", "Snooze to tomorrow"] })] },
    { id: "w5", category: "booking", urgency: "today", address: "2 Church Street", town: "Ware, SG12 9EN", need: "Confirm the buyer's survey booking", meta: "James booked this for tomorrow, 2pm", actions: [A("Confirm", { primary: true, menu: ["Desktop valuation", "Log it", "Not a real booking"] })] },
    { id: "w6", category: "mortgage", urgency: "today", address: "18 Riverside", town: "Hertford, SG14 1RX", need: "Buyer's mortgage offer expires soon", meta: "Buyer offer · expires in 9 days", actions: [A("Open file", { primary: true }), A("Dismiss", { menu: ["Dismiss for 2 weeks"] })] },
    { id: "w7", category: "review", urgency: "today", address: "5 Meadow Way", town: "Harlow, CM20 2EP", need: "Return date arrived — decide the next move", meta: "On hold until today", actions: [A("Decide", { primary: true, menu: ["Take off hold", "Done — resume", "Wait on it", "Pick a date", "Withdraw"] })] },
    { id: "w8", category: "filing", urgency: "week", address: "Needs filing", town: "3 emails from solicitors", need: "Place 3 emails on a file", meta: "Oldest 2 days ago", actions: [A("File all 3", { primary: true }), A("Dismiss")] },
    { id: "w9", category: "quiet", urgency: "week", address: "63 Elm Grove", town: "Cheshunt, EN8 9AS", need: "Client has gone quiet", meta: "No portal activity for 18 days", actions: [A("Send a nudge", { primary: true }), A("Dismiss", { menu: ["Dismiss for 2 weeks"] })] },
    { id: "w10", category: "enquiry", urgency: "week", address: "11 Station Road", town: "Ware, SG12 0AQ", need: "Enquiry loop silent for 3+ weeks", meta: "With Duggan & Co · quiet 23 days", actions: [A("Chase solicitor", { primary: true })] },
  ],
  pipeline: {
    activeFiles: 34, exchangingSoon: 6, needsAttention: 11, escalated: 2,
    pipelineValueM: 11.2, feesK: 48, newThisMonth: 5,
    medianDays: 71, within12Pct: 64, exchLast30: 9, momentumPct: 18, spark: [4, 6, 5, 7, 6, 8, 7, 9],
    stages: [
      { key: "just_in", label: "Just in", count: 5, sample: "9 Kingfisher Drive" },
      { key: "moving", label: "Moving", count: 8, sample: "3 Maple Court" },
      { key: "legal", label: "Legal work", count: 11, sample: "14 Bushey Avenue" },
      { key: "nearly", label: "Nearly there", count: 4, sample: "7 Victoria Road" },
      { key: "exchanged", label: "Exchanged", count: 3, sample: "2 Church Street" },
      { key: "completed", label: "Completed", count: 3, sample: "22 Nathaniels Walk" },
    ],
  },
  wins: { exchanges: 9, fastestDays: 38, biggestFeeK: 7.4, completions: 6, newBusiness: 5 },
  forecast: [
    { label: "This week", count: 3, feesK: 12, current: true },
    { label: "Next week", count: 2, feesK: 8 },
    { label: "In 2 wks", count: 4, feesK: 17 },
    { label: "In 3 wks", count: 1, feesK: 4 },
    { label: "In 4 wks", count: 2, feesK: 9 },
  ],
  activity: [
    { id: "a1", kind: "milestone", description: "You confirmed enquiries raised", context: "14 Bushey Avenue", at: "18m ago" },
    { id: "a2", kind: "comm", description: "Solicitor replied to our chase", context: "3 Maple Court", at: "52m ago" },
    { id: "a3", kind: "milestone", description: "Searches received, no adverse entries", context: "7 Victoria Road", at: "2h ago" },
    { id: "a4", kind: "comm", description: "Buyer completed ID checks", context: "18 Riverside", at: "4h ago" },
    { id: "a5", kind: "milestone", description: "Memorandum of sale issued", context: "41 Oak Lane", at: "Yesterday" },
  ],
};

// ── Roles — drives banners, subtitle, lower-right card, labels, empty variant ──
export type RoleKey = "director" | "negotiator" | "progressor" | "admin" | "owner";
export type RoleCfg = {
  key: RoleKey; label: string; name: string; subtitle: string;
  canCreateSale: boolean; banners: string[]; lowerRight: "service" | "clients" | "none";
  moneyLabel: string; // pipeline-value sub-label
};
export const ROLES: Record<RoleKey, RoleCfg> = {
  director: { key: "director", label: "Agency director", name: "Ellis", subtitle: "Everything's on track. Nothing needs your attention today.", canCreateSale: true, banners: ["email"], lowerRight: "service", moneyLabel: "£4.1m closing" },
  negotiator: { key: "negotiator", label: "Negotiator", name: "Sam", subtitle: "Here's what's happening with your sales today.", canCreateSale: true, banners: [], lowerRight: "service", moneyLabel: "£1.8m closing" },
  progressor: { key: "progressor", label: "TSP progressor", name: "Priya", subtitle: "Here's what's happening with your assigned files today.", canCreateSale: false, banners: [], lowerRight: "none", moneyLabel: "≈ £12k our fees" },
  admin: { key: "admin", label: "Admin (platform)", name: "Alex", subtitle: "Here's what's happening across the platform today.", canCreateSale: true, banners: [], lowerRight: "service", moneyLabel: "≈ £48k our fees" },
  owner: { key: "owner", label: "Business owner", name: "Jordan", subtitle: "Here's what's happening across your clients today.", canCreateSale: true, banners: ["card"], lowerRight: "clients", moneyLabel: "£3.3m · £19k fees" },
};

export const CLIENTS = [
  { name: "Harpers Estates", active: 12, pipelineM: 4.1, feeK: 7.2 },
  { name: "Weston & Co", active: 8, pipelineM: 2.6, feeK: 4.8 },
  { name: "Bridge Property", active: 5, pipelineM: 1.9, feeK: 0, feeUnset: true },
];
