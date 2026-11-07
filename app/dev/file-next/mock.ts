// File Next — isolated /dev prototype of the agent file/transaction page in the
// "bench + glass" language. Mock data shaped to the real page (hero, milestone
// strip, tabs, overview with enquiry tracker + mortgage, a rich sidebar of
// people/dates/chain/mortgage, and an activity feed). No DB, no production code.

export type Tone = "coral" | "amber" | "blue" | "green" | "slate";

export type Stage = { key: string; label: string; state: "done" | "current" | "todo"; when?: string };

export type Party = {
  name: string; role: string; firm?: string; initials: string; hue: number;
  recency: string; state: "ok" | "waiting" | "overdue";
};

export type EnquiryState = "raised" | "replied" | "resolved";
export type Enquiry = {
  id: string; title: string; detail: string; raisedBy: string; waiting: string;
  state: EnquiryState; tone: Tone;
  thread: { from: string; side: "solicitor" | "you" | "seller"; when: string; body: string }[];
};

export type Activity = { id: string; icon: "note" | "reply" | "doc" | "step" | "alert" | "call"; text: string; sub?: string; when: string; who: string };

export const FILE = {
  address: "14 Pennington Grove",
  town: "Harpenden",
  postcode: "AL5 2RD",
  photo: "/dev/workspace-lab/house-d.jpg",
  price: "£685,000",
  tenure: "Freehold" as const,
  service: "Managed sale",
  ref: "TSP-10482",
  stage: "Enquiries",
  progress: 0.52,
  daysToExchange: "about 3 weeks to exchange",

  stages: [
    { key: "instructed", label: "Instructed", state: "done", when: "12 Sep" },
    { key: "searches", label: "Searches", state: "done", when: "28 Sep" },
    { key: "enquiries", label: "Enquiries", state: "current", when: "in progress" },
    { key: "survey", label: "Survey", state: "todo" },
    { key: "exchange", label: "Exchange", state: "todo", when: "target 28 Nov" },
    { key: "completion", label: "Completion", state: "todo" },
  ] as Stage[],

  // the overview headline + the one next action
  summary: "Everything is moving, but the contract pack is held up by one enquiry. Clearing it is the single thing that keeps exchange on track.",
  nextAction: { label: "Reply to the solicitor", context: "The FENSA certificate is the only open item blocking the pack." },

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
        { from: "You", side: "you", when: "3 days ago", body: "Shared with number 12 under a maintenance arrangement. Details and the search entry sent over." },
      ],
    },
  ] as Enquiry[],

  mortgage: { lender: "Halifax", amount: "£479,500", status: "Offer issued", note: "Offer valid to 14 Feb", tone: "green" as Tone },

  people: [
    { name: "Margaret & Roy Ellison", role: "Seller", initials: "ME", hue: 18, recency: "Spoke 3 days ago", state: "ok" },
    { name: "Daniel Osei", role: "Buyer", initials: "DO", hue: 205, recency: "Awaiting your reply", state: "waiting" },
    { name: "Priya Shah", role: "Seller's solicitor", firm: "Dawson Hart", initials: "PS", hue: 150, recency: "Emailed yesterday", state: "ok" },
    { name: "James Hartley", role: "Buyer's solicitor", firm: "Hartley & Co", initials: "JH", hue: 265, recency: "Raised 3 enquiries", state: "waiting" },
    { name: "Rebecca Nolan", role: "Estate agent", firm: "Preston & Vale", initials: "RN", hue: 32, recency: "Agreed the sale", state: "ok" },
  ] as Party[],

  progressor: { name: "Ellis Askey", role: "Your file", initials: "EA" },

  keyDates: [
    { label: "Offer accepted", value: "22 August", tone: "slate" as Tone },
    { label: "Target exchange", value: "28 November", tone: "coral" as Tone, emphasis: true },
    { label: "Target completion", value: "12 December", tone: "slate" as Tone },
  ],

  chain: {
    position: "Middle of a chain of three",
    links: [
      { address: "Flat 9, Alma Road", town: "Luton", role: "Buyer's sale", state: "ok", stage: "Exchange ready" },
      { address: "14 Pennington Grove", town: "Harpenden", role: "This sale", state: "current", stage: "Enquiries" },
      { address: "3 Oakfield Close", town: "Wheathampstead", role: "Onward purchase", state: "waiting", stage: "Searches" },
    ],
  },

  documents: [
    { name: "Local-Authority-Search.pdf", kind: "Search", when: "yesterday" },
    { name: "Draft-Contract.pdf", kind: "Contract", when: "4 days ago" },
    { name: "Property-Information-Form.pdf", kind: "TA6", when: "1 week ago" },
    { name: "Mortgage-Offer.pdf", kind: "Mortgage", when: "1 week ago" },
    { name: "Title-Register.pdf", kind: "Title", when: "2 weeks ago" },
  ],

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
  { key: "activity", label: "Activity" },
  { key: "chain", label: "Chain" },
  { key: "documents", label: "Documents" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];
