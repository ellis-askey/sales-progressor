// File Next — isolated /dev prototype of the agent file/transaction page, levelled
// up to carry the REAL page's density (app nav, top bar, full hero meta, 7-step
// milestone strip, contacts with actions, sale-health scoring, chain cards, key
// dates, agent, fees, enquiries, activity). The point is to show the new STYLING
// over the real amount of information, losing nothing. Mock only; no DB, no prod.

export type Tone = "coral" | "amber" | "blue" | "green" | "slate";

export type Stage = { n: number; key: string; label: string; state: "done" | "current" | "todo"; when?: string };
export type EnquiryState = "raised" | "replied" | "resolved";
export type Enquiry = {
  id: string; title: string; detail: string; raisedBy: string; waiting: string; state: EnquiryState; tone: Tone;
  thread: { from: string; side: "solicitor" | "you" | "seller"; when: string; body: string }[];
};
export type Contact = { name: string; role: "Vendor" | "Purchaser"; phone?: string; initials: string; hue: number; state: "ok" | "waiting" | "overdue" };
export type Activity = { id: string; icon: "note" | "reply" | "doc" | "step" | "alert" | "call"; text: string; sub?: string; when: string; who: string };

export const NAV = [
  { key: "new", label: "New sale", icon: "plus", primary: true },
  { key: "hub", label: "Hub", icon: "house" },
  { key: "focus", label: "Focus", icon: "target" },
  { key: "reminders", label: "Reminders", icon: "bell" },
  { key: "enquiries", label: "Enquiries", icon: "chat", count: 6 },
  { key: "completions", label: "Completions", icon: "check" },
  { key: "todo", label: "To-Do", icon: "list", count: 22 },
  { key: "updates", label: "Updates", icon: "refresh" },
  { key: "emails", label: "Auto emails", icon: "mail" },
  { key: "files", label: "My Files", icon: "folder", active: true },
  { key: "chains", label: "Chains", icon: "link" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "admin", label: "Admin", icon: "gear" },
  { key: "partners", label: "Partners", icon: "handshake" },
] as const;

export const FILE = {
  address: "14 Pennington Grove",
  town: "Harpenden",
  postcode: "AL5 2RD",
  photo: "/dev/workspace-lab/house-d.jpg",
  status: "Active",
  pct: 52,
  ref: "TSP-10482",
  stage: "Enquiries",
  daysToExchange: "about 3 weeks to exchange",

  meta: [
    { icon: "coins", label: "Sale price", value: "£685,000" },
    { icon: "key", label: "Purchase type", value: "Cash buyer" },
    { icon: "house", label: "Tenure", value: "Freehold" },
    { icon: "calendar", label: "Expected exchange", value: "28 Nov 2026" },
  ],
  managing: { name: "Ellis Askey", sub: "Managing this file" },
  onFile: { weeks: "19 weeks 4 days", added: "Added 23 Jun 2026" },
  managedBy: "Managed by TSP",

  stages: [
    { n: 1, key: "instructed", label: "Instructed", state: "done", when: "24 Jun" },
    { n: 2, key: "draft", label: "Draft pack", state: "done", when: "10 Jul" },
    { n: 3, key: "finances", label: "Finances", state: "done", when: "In place" },
    { n: 4, key: "searches", label: "Searches", state: "done", when: "11 Aug" },
    { n: 5, key: "enquiries", label: "Enquiries", state: "current", when: "In progress" },
    { n: 6, key: "exchange", label: "Exchange", state: "todo", when: "~28 Nov" },
    { n: 7, key: "completion", label: "Completion", state: "todo", when: "Pending" },
  ] as Stage[],

  banner: { title: "Exchange is running behind target", body: "Now expected around 28 November 2026, over two weeks late. Waiting on all enquiries to be satisfied." },

  summary: "Everything is moving, but the contract pack is held up by one enquiry.",
  nextAction: { label: "Reply to the solicitor", context: "The FENSA certificate is the only open item blocking the pack." },

  contacts: [
    { name: "Margaret Ellison", role: "Vendor", phone: "+44 7788 533503", initials: "ME", hue: 18, state: "ok" },
    { name: "Roy Ellison", role: "Vendor", phone: "+44 7773 058448", initials: "RE", hue: 18, state: "ok" },
    { name: "Daniel Osei", role: "Purchaser", phone: "+44 7484 196603", initials: "DO", hue: 205, state: "waiting" },
    { name: "Priya Osei", role: "Purchaser", initials: "PO", hue: 205, state: "ok" },
  ] as Contact[],

  professionals: [
    { name: "Priya Shah", role: "Seller's solicitor", firm: "Dawson Hart", initials: "PS", hue: 150, state: "ok", recency: "Emailed yesterday" },
    { name: "James Hartley", role: "Buyer's solicitor", firm: "Hartley & Co", initials: "JH", hue: 265, state: "waiting", recency: "Raised 3 enquiries" },
  ],

  enquiries: [
    {
      id: "e1", title: "FENSA certificate for the replacement windows", detail: "The buyer's solicitor needs proof the 2019 windows were signed off.",
      raisedBy: "Buyer's solicitor", waiting: "6 days", state: "raised", tone: "amber",
      thread: [
        { from: "Hartley & Co", side: "solicitor", when: "6 days ago", body: "We note the windows were replaced in 2019. Please provide the FENSA or building regulations certificate before we report to our client." },
        { from: "You", side: "you", when: "5 days ago", body: "Asked the Ellisons to locate it. Margaret thinks it is in the loft with the house file." },
        { from: "Margaret Ellison", side: "seller", when: "2 days ago", body: "Found a folder from the installer but not sure it is the right certificate. Happy to photograph it and send over." },
      ],
    },
    {
      id: "e2", title: "Boundary on the eastern fence line", detail: "Confirmed. The deed plan matches the fence and a copy is with both solicitors.",
      raisedBy: "Buyer's solicitor", waiting: "closed", state: "resolved", tone: "green",
      thread: [
        { from: "Hartley & Co", side: "solicitor", when: "2 weeks ago", body: "Please confirm the boundary to the east." },
        { from: "You", side: "you", when: "11 days ago", body: "Deed plan confirms the fence line. Copy sent across." },
      ],
    },
    {
      id: "e3", title: "Shared drainage with number 12", detail: "Replied. Waiting for the buyer's solicitor to confirm they are satisfied.",
      raisedBy: "Buyer's solicitor", waiting: "3 days", state: "replied", tone: "blue",
      thread: [
        { from: "Hartley & Co", side: "solicitor", when: "8 days ago", body: "Is the drainage to the rear shared with the neighbouring property?" },
        { from: "You", side: "you", when: "3 days ago", body: "Shared with number 12 under a maintenance arrangement. The search entry is enclosed." },
      ],
    },
  ] as Enquiry[],

  saleHealth: {
    status: "Off track",
    metrics: [
      { label: "Time on file", value: "2h 42m" },
      { label: "Agent", value: "6 mins" },
      { label: "Our team", value: "2h 36m" },
      { label: "Stage", value: "Conveyancing" },
      { label: "Risk level", value: "Medium" },
      { label: "Last activity", value: "Yesterday, 12:44" },
    ],
    score: [
      { label: "Progress vs pace", sub: "Significantly behind the 12-week exchange target", points: "+40", tone: "coral" as Tone },
      { label: "No recent step completed", sub: "No step completed in 36 days", points: "+10", tone: "amber" as Tone },
    ],
  },

  keyDates: [
    { label: "12-week target", value: "15 September 2026", emph: false },
    { label: "Completion", value: "Awaiting exchange", emph: false },
    { label: "Est. time to exchange", value: "6 weeks, 2 days", emph: true },
  ],
  keyDatesNote: "Chain not factored. This prediction is for this sale alone.",

  agent: { name: "Taylor Kay", firm: "Akeman Residential", email: "taylor@akeman-residential.co.uk" },

  fees: [
    { label: "Purchase price", value: "£685,000" },
    { label: "Agent fee", value: "£10,275" },
    { label: "Our fee", value: "£1,200" },
  ],

  chain: {
    position: "Middle of a chain of three",
    cards: [
      { tag: "Related sale", address: "67a Blackberry Lane", town: "Luton", sub: "Exchange ready", pct: 86, state: "ok", photo: "/dev/workspace-lab/house-b.jpg" },
      { tag: "This sale", address: "14 Pennington Grove", town: "Harpenden", sub: "Enquiries in progress", pct: 52, state: "current", photo: "/dev/workspace-lab/house-d.jpg" },
      { tag: "Onward purchase", address: "3 Oakfield Close", town: "Wheathampstead", sub: "Searches", pct: 20, state: "waiting", photo: "/dev/workspace-lab/house-e.jpg" },
    ],
  },

  property: { floorArea: "174 m²", localAuthority: "St Albans", councilTax: "Band F", sources: "GOV.UK EPC Register, HM Land Registry, postcodes.io" },

  activity: [
    { id: "a1", icon: "reply", text: "A solicitor replied to our chase", sub: "The boundary runs along the eastern fence line; the deed plan is enclosed.", when: "52m ago", who: "Hartley & Co" },
    { id: "a2", icon: "note", text: "You confirmed all enquiries have been raised with the seller's solicitor", when: "2h ago", who: "You" },
    { id: "a3", icon: "doc", text: "Priya Shah uploaded Local-Authority-Search.pdf", when: "yesterday", who: "Dawson Hart" },
    { id: "a4", icon: "step", text: "Searches marked complete", sub: "No adverse entries found", when: "yesterday", who: "You" },
    { id: "a5", icon: "alert", text: "The buyer completed their identity checks", sub: "ID verified", when: "2 days ago", who: "Hartley & Co" },
    { id: "a6", icon: "call", text: "Called Margaret about the FENSA certificate", sub: "She is checking the loft for the paperwork", when: "2 days ago", who: "You" },
  ] as Activity[],
};

export type FileData = typeof FILE;

export const TABS = [
  { key: "overview", label: "Overview" },
  { key: "chain", label: "Chain" },
  { key: "activity", label: "Activity" },
  { key: "property", label: "Property" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];
