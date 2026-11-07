// Workspace Lab — isolated /dev design experiment. Mock property + daily-work data
// only. No DB, no server, no real sends. UK conveyancing scenario. Photography is
// illustrative (Unsplash, pulled to /public/dev/workspace-lab at build time).

export type Tone = "coral" | "amber" | "blue" | "green" | "slate";

export type Person = {
  name: string;
  role: "Seller" | "Buyer";
  initials: string;
  hue: number;        // avatar tint
  lastContact: string; // human
  state: "ok" | "waiting" | "overdue";
};

export type ThreadNote = {
  from: string;
  side: "solicitor" | "you" | "seller";
  when: string;
  body: string;
};

export type Enquiry = {
  title: string;
  summary: string;
  raisedBy: string;     // whose solicitor
  waiting: string;      // "6 days"
  tone: Tone;
  thread: ThreadNote[];
};

export type Property = {
  id: string;
  line1: string;
  town: string;
  postcode: string;
  photo: string;        // /public path
  price: string;
  tenure: "Freehold" | "Leasehold";
  stage: string;
  progress: number;     // 0..1 through the transaction
  statusTone: Tone;
  statusLine: string;   // one line over the photo
  seller: Person;
  buyer: Person;
  enquiry: Enquiry;
};

const P = "/dev/workspace-lab";

export const PROPERTIES: Property[] = [
  {
    id: "pennington",
    line1: "14 Pennington Grove",
    town: "Harpenden",
    postcode: "AL5 2RD",
    photo: `${P}/house-d.jpg`,
    price: "£685,000",
    tenure: "Freehold",
    stage: "Enquiries",
    progress: 0.52,
    statusTone: "amber",
    statusLine: "One enquiry is holding up the contract pack",
    seller: { name: "Margaret & Roy Ellison", role: "Seller", initials: "ME", hue: 18, lastContact: "Spoke 3 days ago", state: "ok" },
    buyer: { name: "Daniel Osei", role: "Buyer", initials: "DO", hue: 205, lastContact: "Awaiting your reply", state: "waiting" },
    enquiry: {
      title: "FENSA certificate for the replacement windows",
      summary: "The buyer's solicitor needs proof the 2019 windows were signed off.",
      raisedBy: "Buyer's solicitor",
      waiting: "6 days",
      tone: "amber",
      thread: [
        { from: "Hartley & Co (buyer's solicitor)", side: "solicitor", when: "6 days ago", body: "We note the windows were replaced in 2019. Please provide the FENSA certificate or building regulations completion certificate before we can report to our client." },
        { from: "You", side: "you", when: "5 days ago", body: "Asked the Ellisons to locate the paperwork. Margaret thinks it is in the loft with the house file." },
        { from: "Margaret Ellison", side: "seller", when: "2 days ago", body: "Found a folder from the installer but not sure it is the right certificate. Happy to photograph it and send over." },
      ],
    },
  },
  {
    id: "holywell",
    line1: "29 Holywell Hill",
    town: "St Albans",
    postcode: "AL1 1HD",
    photo: `${P}/house-a.jpg`,
    price: "£895,000",
    tenure: "Freehold",
    stage: "Survey",
    progress: 0.4,
    statusTone: "blue",
    statusLine: "Survey report in. Buyer reviewing the findings",
    seller: { name: "Dr Vanessa Crewe", role: "Seller", initials: "VC", hue: 265, lastContact: "Spoke yesterday", state: "ok" },
    buyer: { name: "Ryan Doyle", role: "Buyer", initials: "RD", hue: 150, lastContact: "Emailed 2 days ago", state: "ok" },
    enquiry: {
      title: "Damp reading flagged in the survey",
      summary: "The surveyor noted elevated moisture to the rear wall and suggested further investigation.",
      raisedBy: "Buyer",
      waiting: "2 days",
      tone: "blue",
      thread: [
        { from: "Ryan Doyle (buyer)", side: "solicitor", when: "2 days ago", body: "The survey picked up damp on the rear elevation. Could we get a specialist to take a look before we go further?" },
        { from: "You", side: "you", when: "1 day ago", body: "Arranging a damp specialist to attend this week. Will coordinate access with Dr Crewe." },
      ],
    },
  },
  {
    id: "verulam",
    line1: "Flat 2, 88 Verulam Road",
    town: "Watford",
    postcode: "WD17 1EP",
    photo: `${P}/house-c.jpg`,
    price: "£315,000",
    tenure: "Leasehold",
    stage: "Searches",
    progress: 0.33,
    statusTone: "slate",
    statusLine: "Local authority search is running slow",
    seller: { name: "Grace Adeyemi", role: "Seller", initials: "GA", hue: 32, lastContact: "Spoke 5 days ago", state: "ok" },
    buyer: { name: "Callum Fraser", role: "Buyer", initials: "CF", hue: 220, lastContact: "Last message bounced", state: "overdue" },
    enquiry: {
      title: "Managing agent pack outstanding",
      summary: "The leasehold management pack has been requested but not yet returned.",
      raisedBy: "Buyer's solicitor",
      waiting: "11 days",
      tone: "slate",
      thread: [
        { from: "Rowe Legal (buyer's solicitor)", side: "solicitor", when: "11 days ago", body: "Please confirm when the LPE1 and management pack will be available from the managing agent." },
        { from: "You", side: "you", when: "9 days ago", body: "Chased the managing agent. They quote 10 working days from payment, which cleared last Tuesday." },
      ],
    },
  },
  {
    id: "cowper",
    line1: "23 Cowper Road",
    town: "Berkhamsted",
    postcode: "HP4 3DT",
    photo: `${P}/house-b.jpg`,
    price: "£740,000",
    tenure: "Freehold",
    stage: "Exchange",
    progress: 0.86,
    statusTone: "green",
    statusLine: "Both sides ready. Agreeing a completion date",
    seller: { name: "Eleanor Whitcombe", role: "Seller", initials: "EW", hue: 340, lastContact: "Spoke today", state: "ok" },
    buyer: { name: "Mohammed & Layla Rahman", role: "Buyer", initials: "MR", hue: 190, lastContact: "Emailed today", state: "ok" },
    enquiry: {
      title: "Completion date to confirm",
      summary: "Both solicitors are ready. The buyer has asked for a date two weeks out.",
      raisedBy: "Buyer",
      waiting: "today",
      tone: "green",
      thread: [
        { from: "Mohammed Rahman (buyer)", side: "solicitor", when: "today", body: "We would ideally complete on the 21st to line up with our mortgage offer and the removal van we have booked." },
        { from: "You", side: "you", when: "today", body: "Checking the 21st works for Eleanor. It is a Friday, which suits most parties." },
      ],
    },
  },
  {
    id: "gade",
    line1: "5 Gade Avenue",
    town: "Hemel Hempstead",
    postcode: "HP1 1BS",
    photo: `${P}/house-e.jpg`,
    price: "£430,000",
    tenure: "Freehold",
    stage: "Instructed",
    progress: 0.14,
    statusTone: "coral",
    statusLine: "Fresh instruction. Contract pack being prepared",
    seller: { name: "Bernard Holloway", role: "Seller", initials: "BH", hue: 95, lastContact: "Spoke last week", state: "waiting" },
    buyer: { name: "Sophie Clarke", role: "Buyer", initials: "SC", hue: 285, lastContact: "Welcome email sent", state: "ok" },
    enquiry: {
      title: "Fittings and contents form outstanding",
      summary: "The seller still needs to complete and return the TA10 form.",
      raisedBy: "You",
      waiting: "4 days",
      tone: "coral",
      thread: [
        { from: "You", side: "you", when: "4 days ago", body: "Sent Bernard the property information and fittings forms to complete and return." },
        { from: "Bernard Holloway (seller)", side: "seller", when: "3 days ago", body: "Working through them this weekend. The fittings one is taking a bit of thought." },
      ],
    },
  },
];

// ── the day's work ───────────────────────────────────────────────────────────
export type WorkKind = "reminder" | "task" | "contact";

export type WorkItem = {
  id: string;
  kind: WorkKind;
  title: string;
  property: string;      // address context
  when: string;          // "Today", "9:30", "Overdue"
  tone: Tone;
  done: boolean;
  detail: string;        // revealed on expand
  actions: string[];     // revealed actions
};

export const WORK: WorkItem[] = [
  { id: "w1", kind: "reminder", title: "Chase the FENSA certificate", property: "14 Pennington Grove", when: "Due today", tone: "amber", done: false,
    detail: "Margaret found a folder from the window installer but is unsure it is the right certificate. Ask her to photograph it so you can check before the solicitor does.", actions: ["Call Margaret", "Snooze to tomorrow"] },
  { id: "w2", kind: "contact", title: "Daniel Osei is waiting to hear from you", property: "14 Pennington Grove", when: "6 days", tone: "coral", done: false,
    detail: "The buyer last heard from you when the enquiry was raised. A short note that it is in hand will keep him reassured.", actions: ["Email Daniel", "Log a call"] },
  { id: "w3", kind: "task", title: "Book the damp specialist", property: "29 Holywell Hill", when: "This week", tone: "blue", done: false,
    detail: "The survey flagged moisture to the rear wall. Arrange a specialist and coordinate access with Dr Crewe.", actions: ["Find a specialist", "Message Dr Crewe"] },
  { id: "w4", kind: "contact", title: "Call Callum back about the search delay", property: "Flat 2, 88 Verulam Road", when: "Overdue", tone: "slate", done: false,
    detail: "His last email bounced. Try the mobile on file and let him know the management pack is due back this week.", actions: ["Call Callum", "Update email"] },
  { id: "w5", kind: "task", title: "Confirm the 21st with Eleanor", property: "23 Cowper Road", when: "9:30", tone: "green", done: false,
    detail: "The Rahmans want to complete on Friday the 21st. Check it works for Eleanor so both solicitors can proceed.", actions: ["Message Eleanor", "Open the file"] },
  { id: "w6", kind: "reminder", title: "Bernard's fittings form is due back", property: "5 Gade Avenue", when: "Friday", tone: "coral", done: false,
    detail: "Bernard is working through the TA10 this weekend. A gentle nudge on Friday will keep the contract pack on track.", actions: ["Remind Bernard", "Snooze"] },
];

export const TODAY = { date: "Friday 7 November", lede: "Six to get through. Start with the FENSA chase, it won't keep." };

// canonical conveyancing stages, for the transaction timeline
export const STAGES = ["Instructed", "Searches", "Enquiries", "Survey", "Exchange", "Completion"];
