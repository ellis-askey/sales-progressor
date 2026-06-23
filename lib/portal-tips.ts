// Buyer/seller portal "Helpful to know" tip cards + the "What happens
// next" replacement that fires once the sale has actually completed.
//
// Gated on the canonical exchange/completion milestone codes (VM19/PM26
// for exchange, VM20/PM27 for completion). This file was written 2026-04-23
// against a smaller milestone schema and silently rotted when the schema
// expanded to 47 milestones; the previous gating thought VM12/VM13 etc.
// were the exchange/completion codes, which surfaced as portals showing
// "you are now legally committed" to customers who were still mid-enquiries.
// Audit + remediation 2026-06-19.
//
// Voice: all prose em-dashes replaced with commas/colons/full stops per the
// 2026-06-07 ban (docs/reference/VOICE.md). Subject-line dashes are not
// relevant here — these strings only ever render in the portal body.

export type PortalStage =
  | "onboarding"
  | "early"
  | "active"
  | "pre_exchange"
  | "exchanged"
  | "completed";

export type PortalRole = "vendor" | "purchaser";

export type PortalTip = { text: string };

// Codes detectStage relies on. Exported so the build-time sanity test
// (__tests__/portal-tips/stage-codes.test.ts) can assert each one still
// exists in the canonical milestone schema. If you rename a code in
// prisma/schema.prisma or migrate the schema, update both the constant
// here AND the allowlist in the test.
export const STAGE_TRIGGER_CODES = {
  // Sale has actually completed (legal ownership transferred + funds moved)
  completion: { vendor: "VM20", purchaser: "PM27" },
  // Contracts have actually exchanged (legally binding)
  exchange: { vendor: "VM19", purchaser: "PM26" },
  // Solicitor has confirmed they are ready to exchange
  readyToExchange: { vendor: "VM18", purchaser: "PM25" },
  // First round of enquiries has actually started
  enquiriesStarted: { vendor: "VM10", purchaser: "PM14" },
  // Client has instructed their solicitor
  instructed: { vendor: "VM1", purchaser: "PM1" },
} as const;

const TIPS: Record<PortalStage, { both: string[]; vendor: string[]; purchaser: string[] }> = {
  onboarding: {
    both: [
      "Your solicitor will send a welcome pack and questionnaire. Return it as quickly as possible: this officially kicks off the conveyancing process.",
      "ID verification is a legal requirement. Your solicitor will need a copy of your passport or driving licence, plus a recent utility bill or bank statement dated within 3 months.",
      "The memorandum of sale is not a binding contract. Either side can still pull out. The legal commitment comes much later, at exchange of contracts.",
    ],
    vendor: [
      "Start gathering documents you may need: any guarantees for works done (damp-proofing, windows, boiler service records) and your energy performance certificate.",
    ],
    purchaser: [
      "Check your mortgage agreement in principle hasn't expired. Most last 90 days. Contact your broker now if it's close to expiry.",
    ],
  },
  early: {
    both: [],
    vendor: [
      "If your property is leasehold or share of freehold, a management pack has been requested from your freeholder or managing agent. These can take 4 to 8 weeks. This is one of the most common causes of delays.",
      "If you're also buying, keep in close contact with us and your solicitor about both transactions. Chains move at the speed of the slowest link.",
    ],
    purchaser: [
      "Searches are ordered by your solicitor and typically take 2 to 6 weeks depending on the local authority. There's nothing you need to do, just be patient during this phase.",
      "Your mortgage lender will book a valuation of the property. This is not a structural survey. It's purely for the lender's purposes and won't tell you anything about the condition of the property.",
      "Consider booking an independent survey. A RICS HomeBuyer Report (Level 2) costs around £400 to £700 and covers the condition of the property in detail, something the lender's valuation does not do. It's there for your peace of mind.",
    ],
  },
  active: {
    both: [
      "Enquiries are raised in rounds. Your solicitor may come back with follow-up questions after the first replies arrive. This is completely normal and doesn't indicate a problem.",
      "The quickest thing you can do to speed up your transaction is reply to any requests from your solicitor within 24 hours. Delays compound: a 3-day delay often becomes 2 weeks.",
    ],
    vendor: [
      "Always channel legal questions through your solicitor. Avoid discussing the legal side of the transaction directly with the buyer, as this can cause confusion and complications.",
    ],
    purchaser: [
      "Once search results arrive, your solicitor will review them and flag anything that needs attention. Most searches come back clean, but they may raise points worth querying.",
      "Your mortgage offer should follow the lender's valuation within a week or two. Double-check the interest rate and repayment term match what you agreed with your broker.",
    ],
  },
  pre_exchange: {
    both: [
      "Exchange of contracts is the legal moment of commitment. After exchange, neither side can withdraw without financial penalty, typically 10% of the purchase price.",
      "The completion date is agreed by both parties before exchange and becomes legally binding the moment contracts exchange. Make sure your removal company and any chain links can confirm the date.",
    ],
    vendor: [
      "Your solicitor will send you the contract to sign before exchange. Check the completion date, price, and included fixtures match what was agreed.",
    ],
    purchaser: [
      "Transfer your deposit to your solicitor a few days before exchange. It needs to be cleared funds in their client account before exchange can happen.",
      "Arrange buildings insurance to start from the moment of exchange, not completion. From exchange, the legal risk of the property passes to you as buyer.",
    ],
  },
  exchanged: {
    both: [
      "You are now legally committed. The completion date is fixed and binding. Neither party can withdraw without significant financial consequence.",
      "On completion day, your solicitor manages the transfer of funds electronically. You don't need to be at the property, but keep your phone on in case they need to reach you.",
    ],
    vendor: [
      "Leave manuals, warranties, and service records for any appliances or installations at the property. Your buyer is entitled to these. It's also good practice to leave a note with meter readings.",
      "Your solicitor will redeem your mortgage from the completion funds. Expect a letter from your lender confirming redemption within a few weeks of completion.",
    ],
    purchaser: [
      "If you haven't already booked your removal firm, now's the time. The best firms often book up 3 to 4 weeks ahead.",
      "Start redirecting important post: bank, DVLA, HMRC, GP, employer, pension providers, subscriptions. The Post Office redirect service is worth setting up.",
    ],
  },
  completed: {
    both: [],
    vendor: [],
    purchaser: [],
  },
};

// "What's next" block shown instead of tips on the completed stage
export const COMPLETED_NEXT: Record<PortalRole, string[]> = {
  vendor: [
    "Your solicitor will redeem your mortgage from the completion funds. Expect a letter from your lender confirming this within a few weeks.",
    "Keep your completion statement in a safe place. You may need it for future tax purposes.",
  ],
  purchaser: [
    "Your solicitor will register your ownership at HM Land Registry. This can take several months but they manage it. You'll receive a copy of the title register when done.",
    "Keep your completion statement and transfer deed in a safe place. You may need them for future legal or tax purposes.",
    "If Stamp Duty Land Tax applied to your purchase, your solicitor will have filed the return. Keep the receipt with your records.",
  ],
};

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getStageTips(stage: PortalStage, role: PortalRole, token: string): PortalTip[] {
  if (stage === "completed") return [];
  const bucket = TIPS[stage];
  const all = [...bucket.both, ...(role === "vendor" ? bucket.vendor : bucket.purchaser)];
  if (all.length === 0) return [];

  const weekOfYear = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const offset = (hashCode(token) + weekOfYear) % all.length;

  const picked: string[] = [];
  for (let i = 0; i < Math.min(3, all.length); i++) {
    picked.push(all[(offset + i) % all.length]);
  }
  return picked.map((text) => ({ text }));
}

// Map a transaction's completed-milestone set to a portal stage.
//
// Priority order matters: a later-stage trigger wins over an earlier-stage
// trigger. Vendor side and purchaser side are evaluated independently
// because each receives its own portal token, so a sale's vendor can be
// at pre_exchange while the purchaser is still at active.
//
// All codes resolved via STAGE_TRIGGER_CODES so the build-time sanity test
// can verify they still exist after any schema change.
export function detectStage(
  milestones: Array<{ code: string; isComplete: boolean }>,
  side: PortalRole
): PortalStage {
  const done = new Set(milestones.filter((m) => m.isComplete).map((m) => m.code));

  const c = STAGE_TRIGGER_CODES;
  if (done.has(c.completion[side]))       return "completed";
  if (done.has(c.exchange[side]))         return "exchanged";
  if (done.has(c.readyToExchange[side]))  return "pre_exchange";
  if (done.has(c.enquiriesStarted[side])) return "active";
  if (done.has(c.instructed[side]))       return "early";
  return "onboarding";
}
