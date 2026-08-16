// Buyer/seller portal "Helpful to know" tip cards + the "What happens
// next" replacement that fires once the sale has actually completed.
//
// Two layers of gating:
//   1. detectStage picks the tip POOL (onboarding / early / active /
//      pre_exchange / exchanged / completed) anchored to canonical
//      milestone codes via STAGE_TRIGGER_CODES.
//   2. Per-tip rules (hideOnceDone / requires) refine WITHIN the pool
//      so the portal never tells a customer "your lender will book a
//      valuation" when the valuation is already booked.
//
// Tips carry a title + body (2026-08-16 rework). Pre-exchange now begins
// at "all enquiries satisfied" (VM21/PM20) rather than "solicitor ready to
// exchange" (VM18/PM25), so exchange-prep advice lands in good time.
//
// Gating note: the doneCodes set passed in from the page includes BOTH
// completed and not_required milestones, so a step a client has opted out
// of (e.g. "not getting a survey") counts as done for hiding purposes.
//
// Voice: no em-dashes (docs/reference/VOICE.md).

export type PortalStage =
  | "onboarding"
  | "early"
  | "active"
  | "pre_exchange"
  | "exchanged"
  | "completed";

export type PortalRole = "vendor" | "purchaser";

export type PortalTip = { title: string; text: string };

// Codes detectStage relies on. Exported so the build-time sanity test
// (__tests__/portal-tips/stage-codes.test.ts) can assert each one still
// exists in the canonical milestone schema.
export const STAGE_TRIGGER_CODES = {
  // Sale has actually completed (legal ownership transferred + funds moved)
  completion: { vendor: "VM20", purchaser: "PM27" },
  // Contracts have actually exchanged (legally binding)
  exchange: { vendor: "VM19", purchaser: "PM26" },
  // All enquiries satisfied — the transaction is now moving towards exchange
  enquiriesSatisfied: { vendor: "VM21", purchaser: "PM20" },
  // First round of enquiries has actually started
  enquiriesStarted: { vendor: "VM10", purchaser: "PM14" },
  // Client has instructed their solicitor
  instructed: { vendor: "VM1", purchaser: "PM1" },
} as const;

type TipDef = {
  title: string;
  text: string;
  // Hide this tip once ANY of these milestone codes is done (complete or
  // not_required).
  hideOnceDone?: string[];
  // Only show this tip once ALL of these milestone codes are done.
  requires?: string[];
};

const TIPS: Record<PortalStage, { both: TipDef[]; vendor: TipDef[]; purchaser: TipDef[] }> = {
  onboarding: {
    both: [
      {
        title: "You're not legally committed yet",
        text: "The memorandum of sale records the agreed transaction, but it isn't a binding contract. Either side can still withdraw until contracts are exchanged.",
      },
    ],
    vendor: [
      {
        title: "Get ready for your solicitor",
        text: "Once instructed, your solicitor will send you their terms of business and initial paperwork to complete. Return everything promptly so they can begin preparing the legal paperwork for your sale.",
        hideOnceDone: ["VM3"],
      },
      {
        title: "Get your ID ready",
        text: "Your solicitor will need to verify your identity before they can act for you. Have photo ID and proof of address ready when requested.",
        hideOnceDone: ["VM4"],
      },
      {
        title: "Gather your property paperwork",
        text: "Start gathering any guarantees, warranties, certificates, planning or building regulation documents and records for work carried out at the property. Having these ready can help prevent delays later.",
        hideOnceDone: ["VM6"],
      },
    ],
    purchaser: [
      {
        title: "Get ready for your solicitor",
        text: "Once instructed, your solicitor will usually send you their terms of business and some initial forms to complete, such as a purchaser questionnaire. They'll also ask for information to complete their ID, anti-money laundering and source of funds checks. Having everything ready will help them get started quickly.",
        hideOnceDone: ["PM3"],
      },
      {
        title: "Get your ID and funds evidence ready",
        text: "Your solicitor will need to verify your identity and understand where the money for your purchase is coming from. Have your photo ID, proof of address and evidence of your deposit or other purchase funds ready when requested.",
        hideOnceDone: ["PM3"],
      },
      {
        title: "Check your agreement in principle",
        text: "If you're buying with a mortgage, make sure your agreement in principle is still valid and speak to your broker if anything has changed since you obtained it.",
        hideOnceDone: ["PM5"],
      },
    ],
  },
  early: {
    both: [],
    vendor: [
      {
        title: "Your management pack is being prepared",
        text: "If your property is leasehold or managed, your solicitor has requested the required management information from the freeholder, managing agent or management company. These packs can take time to arrive, so we'll keep an eye on its progress.",
        requires: ["VM8"],
        hideOnceDone: ["VM9"],
      },
      {
        title: "Keep us updated about your onward purchase",
        text: "If you're also buying, let us and your solicitor know about any important developments with your onward purchase. The transactions will need to line up when the chain starts discussing exchange and completion.",
      },
    ],
    purchaser: [
      {
        title: "Your searches are underway",
        text: "Your solicitor has ordered searches with the relevant authorities and providers. Turnaround times vary, and there's normally nothing you need to do while you wait for the results.",
        requires: ["PM8"],
        hideOnceDone: ["PM13"],
      },
      {
        title: "Your lender will arrange a valuation",
        text: "As part of your mortgage application, your lender will usually arrange a valuation to make sure the property is suitable security for the loan. This is for the lender and isn't a survey of the property's condition.",
        requires: ["PM5"],
        hideOnceDone: ["PM6", "PM11"],
      },
      {
        title: "Think about your own survey",
        text: "The lender's valuation isn't a substitute for your own survey. An independent survey can give you a much better understanding of the property's condition and highlight anything that may need further investigation.",
        hideOnceDone: ["PM9"],
      },
    ],
  },
  active: {
    both: [
      {
        title: "It can go quiet at this stage",
        text: "There may be periods where you don't hear much while the solicitors work through enquiries. We're keeping an eye on both sides and chasing for updates where needed, so there's nothing you need to chase yourself.",
        hideOnceDone: ["PM20", "VM21"],
      },
    ],
    vendor: [
      {
        title: "Follow-up enquiries are normal",
        text: "The buyer's solicitor may raise further questions after receiving the first replies. This is a normal part of conveyancing and doesn't necessarily mean there's a problem.",
      },
      {
        title: "Reply quickly when your solicitor needs you",
        text: "Your solicitor may need information or documents from you to answer the buyer's enquiries. Responding promptly can help prevent avoidable delays.",
      },
      {
        title: "Keep legal questions with the solicitors",
        text: "If the buyer raises a legal question with you directly, it's best to pass it to your solicitor rather than trying to resolve it yourself. This keeps the legal communication clear and properly recorded.",
      },
    ],
    purchaser: [
      {
        title: "Follow-up enquiries are normal",
        text: "Enquiries often happen in rounds. Your solicitor may raise further questions after receiving the first replies, which doesn't necessarily mean there's a problem.",
      },
      {
        title: "Reply quickly when your solicitor needs you",
        text: "If your solicitor asks you for information, documents or a decision, responding promptly can help prevent avoidable delays.",
      },
      {
        title: "Your solicitor is reviewing the searches",
        text: "Once all search results have been received, your solicitor will review them and raise any points that need clarification or further investigation.",
        requires: ["PM13"],
        hideOnceDone: ["PM20"],
      },
      {
        title: "Your mortgage application is being finalised",
        text: "Once the lender has completed its valuation, there may still be underwriting or other checks to complete before your formal mortgage offer is issued. Your broker or lender will keep you updated.",
        requires: ["PM6"],
        hideOnceDone: ["PM11"],
      },
      {
        title: "Your enquiries are nearly there",
        text: "Your solicitor will review the replies and raise any follow-up questions they need to. Once they're satisfied with everything, they'll confirm that the enquiries have been satisfied.",
        requires: ["PM14"],
        hideOnceDone: ["PM20"],
      },
    ],
  },
  pre_exchange: {
    both: [],
    vendor: [
      {
        title: "Exchange makes your sale legally binding",
        text: "Once contracts are exchanged, you and the buyer are legally committed to the transaction. Withdrawing after exchange can have significant financial consequences.",
      },
      {
        title: "Think about your completion date",
        text: "You and the buyer will need to agree a completion date before exchange. Make sure the proposed date works for your move and any onward purchase before you agree to it.",
      },
      {
        title: "Sign your contract documents promptly",
        text: "Your solicitor will send you the contract and any other documents that need signing. Check the details carefully and return everything promptly so they're ready for exchange.",
        requires: ["VM16"],
        hideOnceDone: ["VM17"],
      },
    ],
    purchaser: [
      {
        title: "Exchange makes your purchase legally binding",
        text: "Once contracts are exchanged, you and the seller are legally committed to the transaction. Withdrawing after exchange can have significant financial consequences.",
      },
      {
        title: "Think about your completion date",
        text: "You and the seller will need to agree a completion date before exchange. Make sure the proposed date works for your moving arrangements before you agree to it.",
      },
      {
        title: "Make sure your deposit is ready",
        text: "Your solicitor will tell you how much they need from you and when to send it. Make sure the funds reach their client account in time for exchange.",
        hideOnceDone: ["PM24"],
      },
      {
        title: "Arrange your buildings insurance",
        text: "Your solicitor will tell you when your buildings insurance needs to start. For many purchases this will be from exchange, so make sure your cover is ready before contracts are exchanged.",
        hideOnceDone: ["PM26"],
      },
    ],
  },
  exchanged: {
    both: [],
    vendor: [
      {
        title: "Your completion date is now fixed",
        text: "Your sale is legally binding and the agreed completion date is now fixed. Make sure your moving arrangements are confirmed and you'll be ready to leave the property on time.",
      },
      {
        title: "What happens on completion day",
        text: "The buyer's solicitor will transfer the purchase funds to your solicitor. Keep your phone nearby and we'll let you know once completion has taken place and the keys can be released.",
      },
      {
        title: "Get the property ready for your buyer",
        text: "Gather any manuals, warranties, service records and other useful documents you're leaving behind. Take final meter readings for your records and make sure you've removed everything that isn't included in the sale.",
        hideOnceDone: ["VM20"],
      },
    ],
    purchaser: [
      {
        title: "Your completion date is now fixed",
        text: "Your purchase is legally binding and the agreed completion date is now fixed. Make sure your moving arrangements are confirmed and ready for that date.",
      },
      {
        title: "What happens on completion day",
        text: "Your solicitor will deal with the transfer of funds. Keep your phone nearby and we'll let you know as soon as completion has taken place and the keys are ready to collect.",
      },
      {
        title: "Get ready for moving day",
        text: "Make sure your removals, travel and anything else you need for moving day are arranged now that your completion date is fixed.",
        hideOnceDone: ["PM27"],
      },
      {
        title: "Start changing your address",
        text: "You can start updating your address with your bank, DVLA, HMRC, GP, employer, pension providers and subscriptions. You may also want to arrange a Royal Mail redirection.",
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

// "What happens next" cards shown instead of tips on the completed stage.
// Genuinely post-completion information, so no per-tip gating.
export const COMPLETED_NEXT: Record<PortalRole, { title: string; body: string }[]> = {
  vendor: [
    {
      title: "Your mortgage has been dealt with",
      body: "If you had a mortgage secured against the property, your solicitor will have used the completion funds to repay it. They'll account to you for the remaining sale proceeds after any mortgage, fees and other agreed costs have been paid.",
    },
    {
      title: "Keep your completion statement",
      body: "Keep your completion statement and other important documents from the sale somewhere safe. You may need them for future legal or tax purposes.",
    },
  ],
  purchaser: [
    {
      title: "Your solicitor will register your ownership",
      body: "Your solicitor will deal with registering you as the new owner with HM Land Registry. This can take some time, but there's normally nothing you need to do unless your solicitor contacts you.",
    },
    {
      title: "Keep your important documents",
      body: "Keep your completion statement and any important documents your solicitor sends you somewhere safe. They may be useful when you eventually sell or for future legal or tax purposes.",
    },
    {
      title: "Your SDLT will be dealt with",
      body: "If Stamp Duty Land Tax was payable, your solicitor will usually submit the return and arrange payment on your behalf. Keep any confirmation they provide with your purchase records.",
    },
  ],
};

function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Filter a tip pool against the customer's actual milestone state. Drops
// tips whose hideOnceDone codes are done, and tips whose requires codes
// aren't yet done. Pure: returns a new array; doesn't mutate input.
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
  // Milestone codes the customer has "done" — completed OR not_required.
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
  return picked.map((tip) => ({ title: tip.title, text: tip.text }));
}

// Map a transaction's completed-milestone set to a portal stage.
//
// Priority order matters: a later-stage trigger wins over an earlier-stage
// trigger. Vendor side and purchaser side are evaluated independently
// because each receives its own portal token.
export function detectStage(
  milestones: Array<{ code: string; isComplete: boolean }>,
  side: PortalRole
): PortalStage {
  const done = new Set(milestones.filter((m) => m.isComplete).map((m) => m.code));

  const c = STAGE_TRIGGER_CODES;
  if (done.has(c.completion[side]))        return "completed";
  if (done.has(c.exchange[side]))          return "exchanged";
  if (done.has(c.enquiriesSatisfied[side])) return "pre_exchange";
  if (done.has(c.enquiriesStarted[side]))  return "active";
  if (done.has(c.instructed[side]))        return "early";
  return "onboarding";
}
