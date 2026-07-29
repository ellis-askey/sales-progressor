import type { ScenePalette } from "./PropertyScene";

export type FakeFile = {
  id: string;
  address1: string;
  address2: string;
  postcode: string;
  scene: ScenePalette;
  price: string;
  priceNumeric: number;   // for weight-through-scale
  status: "escalated" | "on_track" | "on_hold" | "completed" | "due_today" | "overdue";
  reason: string;
  progress: number;
  daysInSystem: number;
  exchangeIn: string;
  contacts: { name: string; role: "vendor" | "buyer"; initials: string; hue: number }[];
  nextAction: string;
  nextActionMeta: string;
  agencyName?: string;
  // Hover-preview meta
  lastChasedAgo: string;
  responseTime: string;
  chainStatus: "Intact" | "Declined link" | "No chain";
  weekActivity: number[]; // 7 numbers (Mon–Sun) — small dots showing chase/comm heat
  // Progress-in-time context
  progressContext: string;
};

export const files: FakeFile[] = [
  {
    id: "1",
    address1: "12 Oakfield Road", address2: "Berkhamsted", postcode: "HP4 3XX",
    scene: "golden", price: "£585,000", priceNumeric: 585000,
    status: "escalated", reason: "No response from Grange Legal in 8 days",
    progress: 62, daysInSystem: 74, exchangeIn: "3 weeks",
    contacts: [
      { name: "Ben Palmer", role: "vendor", initials: "BP", hue: 15 },
      { name: "Jessica Palmer", role: "vendor", initials: "JP", hue: 320 },
      { name: "Marcus Chen", role: "buyer", initials: "MC", hue: 250 },
      { name: "Emma Chen", role: "buyer", initials: "EC", hue: 160 },
    ],
    nextAction: "Chase Grange Legal for search results",
    nextActionMeta: "Waiting since 12 May",
    agencyName: "Akeman Residential",
    lastChasedAgo: "3 days ago",
    responseTime: "avg 6d — slow",
    chainStatus: "Declined link",
    weekActivity: [2, 1, 3, 0, 2, 0, 0],
    progressContext: "8 days behind your median for this stage",
  },
  {
    id: "2",
    address1: "43 Willowbrook Crescent", address2: "Chelmsford", postcode: "CM2 8YY",
    scene: "spring", price: "£412,000", priceNumeric: 412000,
    status: "on_track", reason: "Progressing normally",
    progress: 34, daysInSystem: 28, exchangeIn: "8 weeks",
    contacts: [
      { name: "Sarah Whitmore", role: "vendor", initials: "SW", hue: 190 },
      { name: "Tom Whitmore", role: "vendor", initials: "TW", hue: 25 },
      { name: "Alex Reid", role: "buyer", initials: "AR", hue: 280 },
    ],
    nextAction: "Awaiting draft contract from Ashfield & Co",
    nextActionMeta: "Expected by 24 Jul",
    agencyName: "Meldon Estates",
    lastChasedAgo: "yesterday",
    responseTime: "avg 2d — fast",
    chainStatus: "No chain",
    weekActivity: [1, 2, 1, 2, 1, 0, 0],
    progressContext: "on your typical curve",
  },
  {
    id: "3",
    address1: "8 Highfield Court", address2: "Tring", postcode: "HP23 5ZZ",
    scene: "dusk", price: "£495,000", priceNumeric: 495000,
    status: "overdue", reason: "Vendor ID checks 4 days overdue",
    progress: 18, daysInSystem: 12, exchangeIn: "10 weeks",
    contacts: [
      { name: "Rachel Davies", role: "vendor", initials: "RD", hue: 340 },
      { name: "Luke Davies", role: "vendor", initials: "LD", hue: 220 },
    ],
    nextAction: "Chase vendor to complete ID and AML",
    nextActionMeta: "Missed 17 Jul deadline",
    agencyName: "Cesare & Co",
    lastChasedAgo: "4 days ago",
    responseTime: "no reply yet",
    chainStatus: "No chain",
    weekActivity: [1, 0, 2, 1, 0, 0, 0],
    progressContext: "4 days behind schedule",
  },
  {
    id: "4",
    address1: "27 Beech Rise", address2: "Woking", postcode: "GU21 2AA",
    scene: "autumn", price: "£720,000", priceNumeric: 720000,
    status: "completed", reason: "Sale completed on 15 Jul",
    progress: 100, daysInSystem: 96, exchangeIn: "Complete",
    contacts: [
      { name: "Michael Grant", role: "vendor", initials: "MG", hue: 10 },
      { name: "Anna Grant", role: "vendor", initials: "AG", hue: 300 },
      { name: "Peter Nash", role: "buyer", initials: "PN", hue: 200 },
      { name: "Sophia Nash", role: "buyer", initials: "SN", hue: 130 },
    ],
    nextAction: "Sale complete",
    nextActionMeta: "Completed 15 Jul",
    agencyName: "Via Properties",
    lastChasedAgo: "last week",
    responseTime: "avg 3d",
    chainStatus: "Intact",
    weekActivity: [1, 2, 1, 3, 2, 0, 0],
    progressContext: "12 days ahead of your median",
  },
  {
    id: "5",
    address1: "5 Ash Grove", address2: "Guildford", postcode: "GU1 4BB",
    scene: "mist", price: "£368,500", priceNumeric: 368500,
    status: "on_hold", reason: "Vendor paused for family reasons",
    progress: 44, daysInSystem: 51, exchangeIn: "Paused",
    contacts: [
      { name: "Claire Dunne", role: "vendor", initials: "CD", hue: 170 },
      { name: "Harry Dunne", role: "vendor", initials: "HD", hue: 30 },
    ],
    nextAction: "Hold until vendor confirms restart",
    nextActionMeta: "On hold since 3 Jul",
    agencyName: "Oplah Ltd",
    lastChasedAgo: "23 days ago",
    responseTime: "on hold",
    chainStatus: "No chain",
    weekActivity: [0, 0, 0, 0, 0, 0, 0],
    progressContext: "paused — clock stopped",
  },
  {
    id: "6",
    address1: "91 Church Lane", address2: "Hemel Hempstead", postcode: "HP1 3CC",
    scene: "dawn", price: "£462,000", priceNumeric: 462000,
    status: "due_today", reason: "Exchange papers arrive today",
    progress: 88, daysInSystem: 88, exchangeIn: "12 days",
    contacts: [
      { name: "Tim Morris", role: "vendor", initials: "TM", hue: 270 },
      { name: "Gemma Morris", role: "vendor", initials: "GM", hue: 50 },
      { name: "Jack Berry", role: "buyer", initials: "JB", hue: 210 },
    ],
    nextAction: "Confirm exchange papers received",
    nextActionMeta: "Solicitor sending today",
    agencyName: "Akeman Residential",
    lastChasedAgo: "today",
    responseTime: "avg 1d — very fast",
    chainStatus: "Intact",
    weekActivity: [2, 1, 3, 2, 3, 1, 0],
    progressContext: "4 days ahead of median",
  },
];

export const detailFile = files[0];

// The chain for 12 Oakfield Road. Renders top → bottom as an actual chain
// of properties, each with its own PropertyScene.
export const chainLinks: {
  id: string;
  address: string;
  agent: string;
  status: "CLAIMED" | "YOUR FILE" | "DECLINED" | "NOT SENT";
  scene: ScenePalette;
  isViewer: boolean;
  price: string;
}[] = [
  { id: "c1", address: "18 Meadowlark Drive, Berkhamsted", agent: "Sarah at Beechwood Estates", status: "CLAIMED", scene: "autumn", isViewer: false, price: "£820,000" },
  { id: "c2", address: "12 Oakfield Road, Berkhamsted", agent: "You (Akeman Residential)", status: "YOUR FILE", scene: "golden", isViewer: true, price: "£585,000" },
  { id: "c3", address: "4 Church Terrace, Hemel Hempstead", agent: "Philippa at Roger Platt", status: "DECLINED", scene: "mist", isViewer: false, price: "£420,000" },
  { id: "c4", address: "Rose Cottage, Hemel Hempstead", agent: "Awaiting invite", status: "NOT SENT", scene: "spring", isViewer: false, price: "£340,000" },
];

export const chainIntel = {
  totalValue: "£2.16m",
  linkCount: 4,
  claimedCount: 2,
  weakestLink: "Roger Platt · declined 23 Jul",
  predictedCompletion: "late September",
  daysOldest: 74,
};

// This week's rhythm — daily activity counts. Mon..Sun.
export const weekRhythm = {
  today: 2, // index into the array (0 = Mon)
  days: [
    { label: "Mon", value: 8 },
    { label: "Tue", value: 12 },
    { label: "Wed", value: 6 },   // today
    { label: "Thu", value: 0 },   // not-yet
    { label: "Fri", value: 0 },
    { label: "Sat", value: 0 },
    { label: "Sun", value: 0 },
  ],
};

// Contextual greeting — data-driven "here's what I noticed" sentences.
// Randomised on load in the real product; static here so the preview
// is deterministic.
export const greetingInsight = {
  primary: "Grange Legal has been silent 8 days on Oakfield.",
  secondary: "Worth a chase before lunch — their average reply is 6 days.",
};

// Milestones grouped by phase. Each phase gets an illustrated icon.
export type PhaseId = "setup" | "prep" | "enquiries" | "exchange" | "completion";
export const phases: {
  id: PhaseId;
  name: string;
  icon: "key" | "document" | "envelope" | "handshake" | "house";
  state: "done" | "active" | "pending";
  detail: string;
}[] = [
  { id: "setup", name: "Setup", icon: "key", state: "done", detail: "4 of 4 done" },
  { id: "prep", name: "Preparation", icon: "document", state: "active", detail: "2 of 3 · buyer searches ordered" },
  { id: "enquiries", name: "Enquiries", icon: "envelope", state: "pending", detail: "3 steps waiting" },
  { id: "exchange", name: "Exchange", icon: "handshake", state: "pending", detail: "3 steps" },
  { id: "completion", name: "Completion", icon: "house", state: "pending", detail: "2 steps" },
];
