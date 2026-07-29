// Data for /dev/vibe/file — the property file preview.
// Continuation of 12 Oakfield Road from the hub preview.
// Fields mirror the real production components. Anything additive is
// marked "PROPOSED — not on live file today" so it's obvious.

export type FileContact = {
  name: string;
  role: "Vendor" | "Buyer" | "Solicitor" | "Broker";
  initials: string;
  hue: number;
  email: string;
  phone: string;
  portalLogin: string;
  lastContact: string;
  responseAvg: string;
  isLead?: boolean;
};

export const fileContacts: FileContact[] = [
  {
    name: "Ben Palmer", role: "Vendor", initials: "BP", hue: 15,
    email: "ben.palmer@gmail.com", phone: "07892 445 118",
    portalLogin: "yesterday", lastContact: "3 days ago",
    responseAvg: "avg 1d — fast", isLead: true,
  },
  {
    name: "Jessica Palmer", role: "Vendor", initials: "JP", hue: 320,
    email: "jess.palmer@gmail.com", phone: "07711 320 099",
    portalLogin: "not yet", lastContact: "12 days ago",
    responseAvg: "no reply yet",
  },
  {
    name: "Marcus Chen", role: "Buyer", initials: "MC", hue: 250,
    email: "marcus.chen@outlook.com", phone: "07923 887 210",
    portalLogin: "5 days ago", lastContact: "yesterday",
    responseAvg: "avg 3d",
  },
  {
    name: "Emma Chen", role: "Buyer", initials: "EC", hue: 160,
    email: "emma.chen@outlook.com", phone: "07923 887 211",
    portalLogin: "5 days ago", lastContact: "yesterday",
    responseAvg: "avg 3d",
  },
];

// Real SolicitorSection fields
export const solicitor = {
  firm: "Grange Legal",
  contact: "Peter Grange",
  email: "p.grange@grangelegal.co.uk",
  phone: "01442 220 044",
  lastResponse: "8 days ago",
  status: "silent",
  outstanding: "Search results due",
};

export const broker = {
  firm: "Meridian Finance",
  contact: "Rachel Owusu",
  email: "rachel@meridian-finance.co.uk",
  status: "Mortgage offer received",
  offerDate: "18 Jul 2026",
};

// Real Fees card fields. Superadmin view (showOurFee=true).
// Labels match production exactly.
export const fees = {
  purchasePrice: "£585,000",
  agentFee: "1.50% + VAT = £8,775",
  solicitorReferral: "£150",
  brokerReferral: "£250",
  progressorFee: "£250",
  grossIncome: "£9,425",
  netIncome: "£9,425",
};

// Sale Health = real AgentFileSidebar card fields
export const saleHealth = {
  glyph: "!",              // one-char glyph like real card
  phase: "Enquiries",
  timeOnFile: "74 days",
  risk: "Medium",          // Low / Medium / High
  lastActivity: "3h ago",
  score: 62,               // 0..100 for meter fill
};

// Fall-through risk widget — real RiskScoreWidget content
export const riskScore = {
  score: 62,
  band: "medium" as const,   // low / medium / high / no_data
  label: "Medium risk",
  body: "This file has chases or activity gaps that need attention — separate from how steps are progressing",
};

// FileHealthBanner content — real component logic
export const fileHealth = {
  actionableCount: 4,
  overdueCount: 1,
  isBehind: true,
  kind: "danger" as const,     // danger | warning
};

export const keyDates = [
  { label: "Sale added",             date: "12 May 2026",  state: "past"    as const },
  { label: "Memo of sale sent",      date: "14 May 2026",  state: "past"    as const },
  { label: "Buyer AML complete",     date: "22 May 2026",  state: "past"    as const },
  { label: "Vendor solicitor instr.", date: "28 May 2026",  state: "past"    as const },
  { label: "Searches ordered",       date: "6 Jun 2026",   state: "past"    as const },
  { label: "Predicted exchange",     date: "15 Aug 2026",  state: "future"  as const, highlight: true },
  { label: "12-week target",         date: "4 Aug 2026",   state: "warn"    as const },
  { label: "Predicted completion",   date: "5 Sep 2026",   state: "future"  as const },
];

export type ReminderRow = {
  id: string;
  who: string;
  what: string;
  due: string;
  overdue?: boolean;
  channel: "email" | "sms" | "portal";
};

export const reminders: ReminderRow[] = [
  {
    id: "r1", who: "Grange Legal",
    what: "Search results reminder",
    due: "Sent today · no reply",
    overdue: true, channel: "email",
  },
  {
    id: "r2", who: "Ben & Jessica Palmer",
    what: "Weekly update",
    due: "In 2 days", channel: "email",
  },
  {
    id: "r3", who: "Marcus & Emma Chen",
    what: "Weekly update",
    due: "In 2 days", channel: "email",
  },
  {
    id: "r4", who: "Ben Palmer",
    what: "Portal login nudge",
    due: "In 5 days", channel: "portal",
  },
];

export type ActivityItem = {
  id: string;
  timeAgo: string;
  actor: string;
  actorHue?: number;
  event: string;
  detail?: string;
  kind: "chase" | "reply" | "milestone" | "portal" | "system" | "note";
};

export const activity: ActivityItem[] = [
  {
    id: "a1", timeAgo: "3h ago", actor: "You",
    event: "Sent chase to Grange Legal",
    detail: "Follow-up email · third chase this cycle",
    kind: "chase",
  },
  {
    id: "a2", timeAgo: "yesterday", actor: "Marcus Chen",
    actorHue: 250,
    event: "Signed in to portal",
    detail: "Viewed timeline and documents",
    kind: "portal",
  },
  {
    id: "a3", timeAgo: "2 days ago", actor: "You",
    event: "Added note",
    detail: "Grange Legal keep pushing back on searches — worth escalating",
    kind: "note",
  },
  {
    id: "a4", timeAgo: "3 days ago", actor: "You",
    event: "Sent chase to Grange Legal",
    detail: "Second chase — no reply from first",
    kind: "chase",
  },
  {
    id: "a5", timeAgo: "5 days ago", actor: "Meridian Finance",
    actorHue: 200,
    event: "Mortgage offer received",
    detail: "Buyer has valid offer to 31 Oct 2026",
    kind: "milestone",
  },
  {
    id: "a6", timeAgo: "8 days ago", actor: "Ben Palmer",
    actorHue: 15,
    event: "Replied to weekly update",
    detail: "Confirmed happy for chase to continue on solicitor",
    kind: "reply",
  },
];

export const tabCounts = {
  overview: null,
  steps: 5,
  reminders: 4,
  todo: 2,
  activity: null,
};

export const notes = [
  {
    id: "n1", author: "You", timeAgo: "2 days ago",
    body: "Grange Legal keep pushing back on searches. If nothing by Friday I'll escalate to partner level.",
  },
  {
    id: "n2", author: "You", timeAgo: "1 week ago",
    body: "Vendor happy for us to be direct with solicitor. No need to CC.",
  },
];

// Automation state — trimmed to what actually renders on the file today
export const automation = {
  emailsPaused: false,
  serviceType: "self-managed",
  onHold: false,
};

// PropertyIntelCard — real fields.
// Price paid history (up to 5) + EPC section.
export const propertyIntel = {
  postcode: "HP4 3XX",
  caveat: "Data sourced from Land Registry and EPC Register. Always verify before use.",
  priceHistory: [
    { date: "Mar 2022", price: "£560,000", type: "Detached", extras: "Freehold" },
    { date: "Jun 2015", price: "£425,000", type: "Detached", extras: "Freehold" },
    { date: "Oct 2003", price: "£268,500", type: "Detached", extras: "Freehold" },
  ],
  epc: {
    address: "12 Oakfield Road, Berkhamsted HP4 3XX",
    rating: "C",
    score: 72,
    inspected: "May 2019",
  },
};

// PROPOSED — not on live file today. Two "app noticed things" callouts,
// same pattern as the hub v3.1 additions. Kept so we can see what
// additive intelligence looks like alongside the real components.
export const smartCallouts = [
  {
    tone: "warn" as const,
    line: "Grange Legal's median reply time is 6 days. You've now waited 8.",
    action: "Try Peter Grange directly",
  },
  {
    tone: "info" as const,
    line: "Marcus signed into the portal yesterday. Good moment to send an update.",
    action: "Draft buyer update",
  },
];

// Real NextActionCard content
export const nextAction = {
  ruleName: "Chase Grange Legal for search results",
  waitingOn: "Waiting on: Vendor solicitor search return.",
  dueLabel: "3 days overdue",
  dueTone: "overdue" as const,
};

// ═══════════════════════════════════════════════════════════════════
// STEPS TAB — real milestone codes + names from prisma/seed.ts
// Vendor sections: Onboarding, Conveyancing, Exchange & Completion
// Purchaser sections: Onboarding, Finances, Conveyancing, Exchange & Completion
// ═══════════════════════════════════════════════════════════════════

export type MilestoneState = "done" | "available" | "blocked" | "nr";
export type MilestoneSide = "vendor" | "purchaser";

export type Milestone = {
  code: string;
  name: string;
  state: MilestoneState;
  completedDate?: string;
  eventDate?: string;
  confirmedByPortal?: boolean;
  awaitingDays?: number;
  daysOver?: number;
  isGate?: boolean;
  chips?: { tone: "amber" | "emerald" | "slate" | "orange"; text: string }[];
  nrReason?: string;
};

export type MilestoneSection = {
  id: string;
  label: string;
  color: "blue" | "violet" | "sky" | "amber" | "emerald";
  milestones: Milestone[];
};

export const vendorSections: MilestoneSection[] = [
  {
    id: "v-onboarding", label: "Onboarding", color: "blue",
    milestones: [
      { code: "VM1", name: "Seller has instructed their solicitor", state: "done", completedDate: "14 May", confirmedByPortal: true },
      { code: "VM2", name: "Seller has received the memorandum of sale", state: "done", completedDate: "14 May" },
      { code: "VM3", name: "Seller has received the welcome pack from their solicitor", state: "done", completedDate: "22 May" },
      { code: "VM4", name: "Seller has completed ID and AML checks with their solicitor", state: "done", completedDate: "24 May" },
      { code: "VM5", name: "Seller has received the property information forms", state: "done", completedDate: "26 May" },
      { code: "VM6", name: "Seller has returned the property information forms", state: "done", completedDate: "3 Jun" },
    ],
  },
  {
    id: "v-conveyancing", label: "Conveyancing", color: "amber",
    milestones: [
      { code: "VM7", name: "Seller's solicitor has issued the draft contract pack", state: "done", completedDate: "8 Jun" },
      { code: "VM8", name: "Seller's solicitor has answered the initial enquiries", state: "available",
        awaitingDays: 8, daysOver: 3,
        chips: [
          { tone: "amber", text: "3 days slower than typical" },
          { tone: "amber", text: "Client chased yesterday" },
        ]
      },
      { code: "VM9", name: "Seller's solicitor has answered any additional enquiries", state: "blocked" },
      { code: "VM10", name: "Seller has approved the draft contract", state: "blocked" },
      { code: "VM11", name: "Seller has agreed the completion date", state: "blocked" },
      { code: "VM17", name: "Seller has signed the transfer deed", state: "blocked" },
    ],
  },
  {
    id: "v-exchange", label: "Exchange & Completion", color: "emerald",
    milestones: [
      { code: "VM18", name: "Seller side ready to exchange", state: "blocked", isGate: true,
        chips: [{ tone: "amber", text: "Exchange gate" }] },
      { code: "VM19", name: "Exchange of contracts", state: "blocked" },
      { code: "VM20", name: "Sale completed", state: "blocked" },
    ],
  },
];

export const purchaserSections: MilestoneSection[] = [
  {
    id: "p-onboarding", label: "Onboarding", color: "blue",
    milestones: [
      { code: "PM1", name: "Buyer has instructed their solicitor", state: "done", completedDate: "15 May" },
      { code: "PM2", name: "Buyer has received the memorandum of sale", state: "done", completedDate: "14 May" },
      { code: "PM3", name: "Buyer has completed ID and AML checks with their solicitor", state: "done", completedDate: "22 May" },
      { code: "PM4", name: "Buyer has paid money on account to their solicitor", state: "done", completedDate: "24 May" },
    ],
  },
  {
    id: "p-finances", label: "Finances", color: "violet",
    milestones: [
      { code: "PM5", name: "Buyer has submitted their mortgage application", state: "done", completedDate: "20 May" },
      { code: "PM6", name: "Lender valuation has been booked", state: "done", completedDate: "28 May", eventDate: "4 Jun" },
      { code: "PM11", name: "Buyer has received their mortgage offer", state: "done", completedDate: "18 Jul",
        chips: [{ tone: "emerald", text: "Client engaged yesterday" }] },
    ],
  },
  {
    id: "p-conveyancing", label: "Conveyancing", color: "amber",
    milestones: [
      { code: "PM7", name: "Buyer's solicitor has received the draft contract pack", state: "done", completedDate: "10 Jun" },
      { code: "PM8", name: "Buyer's solicitor has ordered searches", state: "done", completedDate: "12 Jun" },
      { code: "PM12", name: "Buyer's solicitor has received the searches", state: "available",
        awaitingDays: 8, daysOver: 3,
        chips: [
          { tone: "amber", text: "3 days slower than typical" },
          { tone: "orange", text: "Awaiting 8 days" },
        ] },
      { code: "PM14", name: "Buyer's solicitor has raised initial enquiries to the seller's solicitor", state: "blocked" },
      { code: "PM15", name: "Buyer's solicitor has received answers to initial enquiries", state: "blocked" },
    ],
  },
  {
    id: "p-exchange", label: "Exchange & Completion", color: "emerald",
    milestones: [
      { code: "PM25", name: "Buyer side ready to exchange", state: "blocked", isGate: true,
        chips: [{ tone: "amber", text: "Exchange gate" }] },
      { code: "PM26", name: "Exchange of contracts", state: "blocked" },
      { code: "PM27", name: "Sale completed", state: "blocked" },
    ],
  },
];

export const stepsProgress = {
  vendorDone: 7, vendorTotal: 15,
  purchaserDone: 8, purchaserTotal: 16,
  percentAll: Math.round((15 / (15 + 16)) * 100),   // 48%
  doneAll: 15,
  totalAll: 31,
};

// ═══════════════════════════════════════════════════════════════════
// REMINDERS TAB — real AutomatedEmailsCard + RemindersSection shape
// ═══════════════════════════════════════════════════════════════════

export const automatedEmails = {
  summary: "3 today · Next: Search results chase to Grange Legal today 14:30",
  paused: false,
  pendingNow: [
    { id: "ae1", chip: "CHASE", subject: "Search results chase — third attempt", to: "Peter Grange", role: "Solicitor", send: "Send Today 14:30" },
    { id: "ae2", chip: "CHASE", subject: "Follow-up on enquiries answered", to: "Peter Grange", role: "Solicitor", send: "Send Today 15:00" },
  ],
  sentToday: [
    { id: "ae3", chip: "NOTIFICATION", subject: "Portal update — searches received", to: "Ben Palmer", role: "Vendor", send: "Sent 09:12" },
  ],
  upcoming: [
    { id: "ae4", chip: "CHASE", subject: "Enquiries answers", to: "Peter Grange", role: "Solicitor", extra: "chase 1 of 2", send: "waiting to send" },
    { id: "ae5", chip: "NOTIFICATION", subject: "Weekly update", to: "Marcus Chen", role: "Buyer", send: "waiting to send" },
  ],
};

export type ReminderUrgency = "escalated" | "overdue" | "due_today" | "coming_up";
export type ReminderSide = "seller" | "buyer";

export type FullReminder = {
  id: string;
  side: ReminderSide;
  urgency: ReminderUrgency;
  title: string;                 // Milestone name (chase prefix stripped)
  urgencyLine: string;            // "3d overdue", "Due today", etc.
  chased: number;
  manualChip?: string;
};

export const fullReminders: FullReminder[] = [
  {
    id: "fr1", side: "seller", urgency: "escalated",
    title: "Seller's solicitor has answered the initial enquiries",
    urgencyLine: "Escalated · 8d overdue", chased: 3,
    manualChip: "14d silent (manual)",
  },
  {
    id: "fr2", side: "buyer", urgency: "overdue",
    title: "Buyer's solicitor has received the searches",
    urgencyLine: "3d overdue", chased: 2,
  },
  {
    id: "fr3", side: "buyer", urgency: "due_today",
    title: "Buyer money paid on account", urgencyLine: "Due today", chased: 0,
  },
  {
    id: "fr4", side: "seller", urgency: "coming_up",
    title: "Weekly portal nudge", urgencyLine: "From 30 Jul", chased: 0,
  },
];

export const snoozedReminders = [
  { id: "sr1", title: "Chase mortgage valuation booking", wakes: "31 Jul" },
];

export const completedReminders = [
  { id: "cr1", title: "Buyer AML follow-up", status: "Done", reason: "Client confirmed manually" },
];

// ═══════════════════════════════════════════════════════════════════
// TO-DO TAB — real ManualTaskList structure
// ═══════════════════════════════════════════════════════════════════

export type Todo = {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  done: boolean;
};

export const agentTodos: Todo[] = [
  { id: "t1", title: "Ring Peter Grange partner-level about search delay", notes: "Try Susan Wren if Peter unreachable — she covers the residential team", due: "Today", done: false },
  { id: "t2", title: "Confirm Marcus is happy with mid-Aug exchange", due: "Tomorrow", done: false },
  { id: "t3", title: "Chase Meridian for updated mortgage offer if survey delays exchange past 31 Oct", done: true },
];

export type AgentRequest = {
  id: string;
  title: string;
  yourNote?: string;
  yourNoteTime?: string;
  spReply?: string;
  spReplyTime?: string;
  done: boolean;
};

export const agentRequests: AgentRequest[] = [
  {
    id: "ar1", title: "Please chase Grange Legal for a partner-level escalation",
    yourNote: "They're not responding to Peter directly", yourNoteTime: "3 days ago",
    done: false,
  },
  {
    id: "ar2", title: "Draft the exchange-week comms for the Palmers",
    spReply: "Draft ready in the portal. Take a look and reply if you want any tone changes.", spReplyTime: "yesterday",
    done: true,
  },
];

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY TAB — real ActivityTimeline shape
// ═══════════════════════════════════════════════════════════════════

export type ActivityFilter = "all" | "steps" | "comms" | "automated" | "notes";

export type FullActivityEntry = {
  id: string;
  timeAgo: string;
  kind: "milestone" | "comm_email" | "comm_call" | "comm_note" | "automated" | "note" | "milestone_nr";
  summary: string;
  meta: string;                                        // "Ben Palmer · 3h ago" etc
  author?: string;
  content?: string;                                    // long-form for comm entries
  edited?: boolean;
  hasMosLink?: boolean;
  mosCode?: string;                                    // VM2 or PM2
  contactPills?: string[];                             // "Ben", "Marcus"
  toneChip?: string;                                   // "Step confirmed" / "Confirmed by client"
  toneChipColor?: "emerald" | "muted";
};

export const fullActivity: FullActivityEntry[] = [
  {
    id: "act1", timeAgo: "3h ago", kind: "comm_email",
    summary: "Third chase to Grange Legal",
    meta: "You · today 09:15",
    contactPills: ["Peter Grange"],
    content: "Following up on the two prior chases. Buyer's solicitor is now waiting on searches to move enquiries forward. Please can you confirm expected turnaround?",
    author: "You",
  },
  {
    id: "act2", timeAgo: "yesterday", kind: "milestone",
    summary: "Buyer has received their mortgage offer",
    meta: "Auto-confirmed · 24 Jul",
    toneChip: "Step confirmed", toneChipColor: "emerald",
  },
  {
    id: "act3", timeAgo: "yesterday", kind: "automated",
    summary: "Portal update sent — searches received",
    meta: "Auto · 09:12 to Ben Palmer",
  },
  {
    id: "act4", timeAgo: "2 days ago", kind: "note",
    summary: "Grange Legal keep pushing back on searches — worth escalating",
    meta: "Internal note · You · 23 Jul",
    author: "You",
  },
  {
    id: "act5", timeAgo: "3 days ago", kind: "comm_call",
    summary: "Called Ben Palmer",
    meta: "You · 22 Jul 14:20",
    contactPills: ["Ben"],
    content: "10 min call. Ben happy for us to be direct with the solicitor. No need to CC on chases.",
    author: "You",
  },
  {
    id: "act6", timeAgo: "5 days ago", kind: "milestone",
    summary: "Lender valuation has been booked",
    meta: "Ellis via portal · 20 Jul",
    toneChip: "Confirmed by client", toneChipColor: "emerald",
  },
  {
    id: "act7", timeAgo: "6 days ago", kind: "milestone",
    summary: "Seller has received the memorandum of sale",
    meta: "Ellis · 19 Jul",
    toneChip: "Step confirmed", toneChipColor: "emerald",
    hasMosLink: true, mosCode: "VM2",
  },
];

