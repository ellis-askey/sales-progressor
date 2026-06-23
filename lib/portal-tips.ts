// Buyer/seller portal "Helpful to know" tip cards + the "What happens
// next" replacement that fires once the sale has actually completed.
//
// Two layers of gating:
//   1. detectStage picks the tip POOL (onboarding / early / active /
//      pre_exchange / exchanged / completed) anchored to canonical
//      milestone codes via STAGE_TRIGGER_CODES.
//   2. Per-tip rules (hideOnceDone / requires) refine WITHIN the pool
//      so the portal never tells a customer "your lender will book a
//      valuation" when the valuation is already booked. Surfaced
//      2026-06-19 by Ellis: a purchaser whose PM6 was complete was
//      still seeing the lender-valuation tip.
//
// Voice: all prose em-dashes replaced with commas/colons/full stops per
// the 2026-06-07 ban (docs/reference/VOICE.md).

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

// Per-tip relevance gates. Layered on top of stage gating: even though
// a tip is in the right stage's pool, hide it if its underlying milestone
// has already moved on (hideOnceDone) or if its premise hasn't landed
// yet (requires). Most tips need neither — pure stage gating is enough.
// Keep code references in the inline allowlist of stage-codes.test.ts
// so a schema rename surfaces in `npm test`.
type TipDef = {
  text: string;
  // Hide this tip once ANY of these milestone codes is complete. Used
  // for tips that talk about a future event ("your lender will book a
  // valuation") which has now happened.
  hideOnceDone?: string[];
  // Only show this tip once ALL of these milestone codes are complete.
  // Used for tips that depend on a precondition ("your mortgage offer
  // should follow the lender's valuation" only fires once the valuation
  // is actually booked).
  requires?: string[];
};

const TIPS: Record<PortalStage, { both: TipDef[]; vendor: TipDef[]; purchaser: TipDef[] }> = {
  onboarding: {
    both: [
      // Vendor stale on VM3 (welcome pack received). Purchaser has no
      // direct welcome-pack milestone, so PM3 (ID/AML complete) is the
      // proxy: by the time ID is verified the welcome pack stage is over.
      {
        text: "Your solicitor will send a welcome pack and questionnaire. Return it as quickly as possible: this officially kicks off the conveyancing process.",
        hideOnceDone: ["VM3", "PM3"],
      },
      {
        text: "ID verification is a legal requirement. Your solicitor will need a copy of your passport or driving licence, plus a recent utility bill or bank statement dated within 3 months.",
        hideOnceDone: ["VM4", "PM3"],
      },
      // General framing about the memorandum. Stays useful through the
      // entire pre-exchange period; stage gating handles the rest.
      {
        text: "The memorandum of sale is not a binding contract. Either side can still pull out. The legal commitment comes much later, at exchange of contracts.",
      },
    ],
    vendor: [
      {
        text: "Start gathering documents you may need: any guarantees for works done (damp-proofing, windows, boiler service records) and your energy performance certificate.",
        hideOnceDone: ["VM6"],
      },
    ],
    purchaser: [
      {
        text: "Check your mortgage agreement in principle hasn't expired. Most last 90 days. Contact your broker now if it's close to expiry.",
        hideOnceDone: ["PM5"],
      },
    ],
  },
  early: {
    both: [],
    vendor: [
      {
        text: "If your property is leasehold or share of freehold, a management pack has been requested from your freeholder or managing agent. These can take 4 to 8 weeks. This is one of the most common causes of delays.",
        hideOnceDone: ["VM9"],
      },
      // General chain advice, no specific milestone trigger.
      {
        text: "If you're also buying, keep in close contact with us and your solicitor about both transactions. Chains move at the speed of the slowest link.",
      },
    ],
    purchaser: [
      {
        text: "Searches are ordered by your solicitor and typically take 2 to 6 weeks depending on the local authority. There's nothing you need to do, just be patient during this phase.",
        hideOnceDone: ["PM13"],
      },
      // THE BUG: this used to fire even after the valuation was booked.
      // PM6 = "Lender valuation has been booked".
      {
        text: "Your mortgage lender will book a valuation of the property. This is not a structural survey. It's purely for the lender's purposes and won't tell you anything about the condition of the property.",
        hideOnceDone: ["PM6"],
      },
      {
        text: "Consider booking an independent survey. A RICS HomeBuyer Report (Level 2) costs around £400 to £700 and covers the condition of the property in detail, something the lender's valuation does not do. It's there for your peace of mind.",
        hideOnceDone: ["PM9"],
      },
    ],
  },
  active: {
    both: [
      // Stage gating handles staleness: once VM18/PM25 fires we're in
      // pre_exchange and this pool isn't drawn from.
      {
        text: "Enquiries are raised in rounds. Your solicitor may come back with follow-up questions after the first replies arrive. This is completely normal and doesn't indicate a problem.",
      },
      {
        text: "The quickest thing you can do to speed up your transaction is reply to any requests from your solicitor within 24 hours. Delays compound: a 3-day delay often becomes 2 weeks.",
      },
    ],
    vendor: [
      {
        text: "Always channel legal questions through your solicitor. Avoid discussing the legal side of the transaction directly with the buyer, as this can cause confusion and complications.",
      },
    ],
    purchaser: [
      {
        text: "Once search results arrive, your solicitor will review them and flag anything that needs attention. Most searches come back clean, but they may raise points worth querying.",
        hideOnceDone: ["PM13"],
      },
      // requires PM6 (valuation booked) so the tip doesn't fire while
      // PM5 is in flight but the valuation hasn't been arranged.
      // hideOnceDone PM11 (mortgage offer received) so it disappears
      // once the offer actually lands.
      {
        text: "Your mortgage offer should follow the lender's valuation within a week or two. Double-check the interest rate and repayment term match what you agreed with your broker.",
        requires: ["PM6"],
        hideOnceDone: ["PM11"],
      },
    ],
  },
  pre_exchange: {
    both: [
      {
        text: "Exchange of contracts is the legal moment of commitment. After exchange, neither side can withdraw without financial penalty, typically 10% of the purchase price.",
      },
      {
        text: "The completion date is agreed by both parties before exchange and becomes legally binding the moment contracts exchange. Make sure your removal company and any chain links can confirm the date.",
      },
    ],
    vendor: [
      {
        text: "Your solicitor will send you the contract to sign before exchange. Check the completion date, price, and included fixtures match what was agreed.",
        hideOnceDone: ["VM17"],
      },
    ],
    purchaser: [
      {
        text: "Transfer your deposit to your solicitor a few days before exchange. It needs to be cleared funds in their client account before exchange can happen.",
        hideOnceDone: ["PM24"],
      },
      {
        text: "Arrange buildings insurance to start from the moment of exchange, not completion. From exchange, the legal risk of the property passes to you as buyer.",
      },
    ],
  },
  exchanged: {
    both: [
      {
        text: "You are now legally committed. The completion date is fixed and binding. Neither party can withdraw without significant financial consequence.",
      },
      {
        text: "On completion day, your solicitor manages the transfer of funds electronically. You don't need to be at the property, but keep your phone on in case they need to reach you.",
      },
    ],
    vendor: [
      {
        text: "Leave manuals, warranties, and service records for any appliances or installations at the property. Your buyer is entitled to these. It's also good practice to leave a note with meter readings.",
        hideOnceDone: ["VM20"],
      },
      // Post-completion expectation: lender confirmation arrives weeks
      // after VM20. Keeping visible across exchanged (and stays useful
      // even as completion lands).
      {
        text: "Your solicitor will redeem your mortgage from the completion funds. Expect a letter from your lender confirming redemption within a few weeks of completion.",
      },
    ],
    purchaser: [
      {
        text: "If you haven't already booked your removal firm, now's the time. The best firms often book up 3 to 4 weeks ahead.",
        hideOnceDone: ["PM27"],
      },
      {
        text: "Start redirecting important post: bank, DVLA, HMRC, GP, employer, pension providers, subscriptions. The Post Office redirect service is worth setting up.",
        hideOnceDone: ["PM27"],
      },
    ],
  },
  completed: {
    both: [],
    vendor: [],
    purchaser: [],
  },
};

// "What's next" block shown instead of tips on the completed stage.
// No per-tip gating: these only render once the sale is fully complete.
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

// Filter a tip pool against the customer's actual milestone state.
// Drops tips whose hideOnceDone codes have already been confirmed, and
// tips whose requires codes haven't yet been confirmed. Pure: returns
// a new array; doesn't mutate input.
export function filterTipsForMilestones(pool: TipDef[], doneCodes: Set<string>): TipDef[] {
  return pool.filter((tip) => {
    if (tip.hideOnceDone && tip.hideOnceDone.some((code) => doneCodes.has(code))) return false;
    if (tip.requires && !tip.requires.every((code) => doneCodes.has(code))) return false;
    return true;
  });
}

export function getStageTips(
  stage: PortalStage,
  role: PortalRole,
  token: string,
  // Set of milestone codes the customer has actually completed. Used
  // for per-tip refinement (hideOnceDone / requires). Pass an empty
  // Set to keep the old all-tips-visible behaviour.
  doneCodes: Set<string> = new Set(),
): PortalTip[] {
  if (stage === "completed") return [];
  const bucket = TIPS[stage];
  const rawAll = [...bucket.both, ...(role === "vendor" ? bucket.vendor : bucket.purchaser)];
  const all = filterTipsForMilestones(rawAll, doneCodes);
  if (all.length === 0) return [];

  const weekOfYear = Math.floor(Date.now() / (7 * 24 * 3600 * 1000));
  const offset = (hashCode(token) + weekOfYear) % all.length;

  const picked: TipDef[] = [];
  for (let i = 0; i < Math.min(3, all.length); i++) {
    picked.push(all[(offset + i) % all.length]);
  }
  return picked.map((tip) => ({ text: tip.text }));
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
