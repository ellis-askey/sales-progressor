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
        text: "The memorandum of sale confirms what's been agreed, but it isn't legally binding. Either side can still withdraw until contracts are exchanged.",
      },
    ],
    vendor: [
      {
        title: "Get ready for your solicitor",
        text: "Once instructed, your solicitor will send you some initial paperwork to complete. Getting this back quickly means they can get started on the legal work for your sale.",
        hideOnceDone: ["VM3"],
      },
      {
        title: "Have your ID ready",
        text: "Your solicitor will need to verify your identity before they can act for you. Have your photo ID and proof of address ready when they ask for it.",
        hideOnceDone: ["VM4"],
      },
      {
        title: "Gather your property paperwork",
        text: "Start gathering any guarantees, warranties, certificates and paperwork for work carried out at the property. Having it to hand now can save time later.",
        hideOnceDone: ["VM6"],
      },
    ],
    purchaser: [
      {
        title: "Get ready for your solicitor",
        text: "Your solicitor will send you some initial paperwork and ask for information to complete their ID, anti-money laundering and source of funds checks. Getting everything back quickly will help them get started.",
        hideOnceDone: ["PM3"],
      },
      {
        title: "Have your ID and funds evidence ready",
        text: "Your solicitor will need to verify your identity and where the money for your purchase is coming from. Have your photo ID, proof of address and evidence of your deposit or other funds ready.",
        hideOnceDone: ["PM3"],
      },
      {
        title: "Check your agreement in principle",
        text: "If you're using a mortgage, check that your agreement in principle is still valid. If anything has changed since you obtained it, let your broker know.",
        hideOnceDone: ["PM5"],
      },
    ],
  },
  early: {
    both: [],
    vendor: [
      {
        title: "Your management pack is being prepared",
        text: "If your property is leasehold or managed, your solicitor will request a management pack. These can sometimes take a while to arrive, so we'll keep an eye on it.",
        requires: ["VM8"],
        hideOnceDone: ["VM9"],
      },
      {
        title: "Keep us updated on your onward purchase",
        text: "If you're buying another property, keep us and your solicitor updated on any important changes. Later on, the dates will need to work across the whole chain.",
      },
    ],
    purchaser: [
      {
        title: "Your searches are underway",
        text: "Your solicitor has ordered the searches for the property. They can take a little while to come back, and there's usually nothing you need to do in the meantime.",
        requires: ["PM8"],
        hideOnceDone: ["PM13"],
      },
      {
        title: "Your lender will arrange a valuation",
        text: "Your lender will usually value the property as part of your mortgage application. This is for the lender's benefit and isn't the same as having your own survey.",
        requires: ["PM5"],
        hideOnceDone: ["PM6", "PM11"],
      },
      {
        title: "Think about your own survey",
        text: "A lender's valuation doesn't check the property for you. If you want a better understanding of its condition, this is the time to arrange your own survey.",
        hideOnceDone: ["PM9"],
      },
    ],
  },
  active: {
    both: [
      {
        title: "Things can go quiet at this stage",
        text: "There can be periods without much news while the solicitors work through enquiries. We're keeping an eye on things and chasing where needed, so you don't need to.",
        hideOnceDone: ["PM20", "VM21"],
      },
    ],
    vendor: [
      {
        title: "More enquiries are completely normal",
        text: "The buyer's solicitor may have more questions after reviewing the first replies. Enquiries often come in rounds, so this doesn't automatically mean there's a problem.",
      },
      {
        title: "Reply quickly if your solicitor needs you",
        text: "Your solicitor may need information or documents from you to answer an enquiry. The sooner they have them, the sooner they can reply.",
      },
      {
        title: "Leave the legal questions to your solicitor",
        text: "If the buyer asks you a legal question directly, pass it to your solicitor rather than answering it yourself. It keeps everything clear and properly recorded.",
      },
    ],
    purchaser: [
      {
        title: "More enquiries are completely normal",
        text: "Your solicitor may have further questions after reviewing the first replies. Enquiries often come in rounds, so this is a normal part of the process.",
      },
      {
        title: "Reply quickly if your solicitor needs you",
        text: "If your solicitor asks for information, documents or a decision, getting back to them quickly will help keep things moving.",
      },
      {
        title: "Your solicitor is reviewing the searches",
        text: "Once the searches are back, your solicitor will review the results and investigate anything that needs a closer look.",
        requires: ["PM13"],
        hideOnceDone: ["PM20"],
      },
      {
        title: "Your mortgage is being finalised",
        text: "Even after the valuation, your lender may still have some final checks to complete before issuing your mortgage offer. Your broker or lender will keep you updated.",
        requires: ["PM6"],
        hideOnceDone: ["PM11"],
      },
      {
        title: "Your enquiries are nearly there",
        text: "Your solicitor is reviewing the replies and will raise any final questions they need to. Once they're happy with everything, the enquiries can be signed off.",
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
        text: "Once contracts are exchanged, you and the buyer are legally committed to the sale. Pulling out after this point can have serious financial consequences.",
      },
      {
        title: "Think about your completion date",
        text: "A completion date needs to be agreed before exchange. Make sure it works for your move and, if you're buying as well, your onward purchase.",
      },
      {
        title: "Return your signed documents promptly",
        text: "Your solicitor will send you the documents that need signing before exchange. Check them carefully and return them promptly so everything is ready when the time comes.",
        requires: ["VM16"],
        hideOnceDone: ["VM17"],
      },
    ],
    purchaser: [
      {
        title: "Exchange makes your purchase legally binding",
        text: "Once contracts are exchanged, you and the seller are legally committed to the purchase. Pulling out after this point can have serious financial consequences.",
      },
      {
        title: "Think about your completion date",
        text: "A completion date needs to be agreed before exchange. Make sure it works for your moving arrangements before agreeing to it.",
      },
      {
        title: "Make sure your deposit is ready",
        text: "Your solicitor will confirm how much they need from you and when. Make sure the funds are available in plenty of time for exchange.",
        hideOnceDone: ["PM24"],
      },
      {
        title: "Get your buildings insurance ready",
        text: "Your solicitor will confirm when your buildings insurance needs to start. This is often from exchange, so make sure you have cover ready beforehand.",
        hideOnceDone: ["PM26"],
      },
    ],
  },
  exchanged: {
    both: [],
    vendor: [
      {
        title: "Your completion date is now fixed",
        text: "Your sale is legally binding and your completion date is agreed. You can now confirm your moving arrangements for the day.",
      },
      {
        title: "What happens on completion day",
        text: "The buyer's solicitor will send the purchase funds to your solicitor. Keep your phone nearby and we'll let you know as soon as completion takes place and the keys can be released.",
      },
      {
        title: "Get the property ready for your buyer",
        text: "Make sure the property is cleared as agreed and gather any manuals, warranties or useful information you're leaving behind. It's also worth taking final meter readings before you leave.",
        hideOnceDone: ["VM20"],
      },
    ],
    purchaser: [
      {
        title: "Your completion date is now fixed",
        text: "Your purchase is legally binding and your completion date is agreed. You can now confirm your moving arrangements for the day.",
      },
      {
        title: "What happens on completion day",
        text: "Your solicitor will handle the transfer of funds. Keep your phone nearby and we'll let you know as soon as completion takes place and the keys are ready.",
      },
      {
        title: "Get ready for completion day",
        text: "With the date now fixed, you can confirm your removals, time off work and anything else you need for moving day.",
        hideOnceDone: ["PM27"],
      },
      {
        title: "Start changing your address",
        text: "You can start updating your address with your bank, DVLA, HMRC, employer and other important services. You may also want to arrange a Royal Mail redirection.",
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
      title: "Your mortgage has been repaid",
      body: "If you had a mortgage on the property, your solicitor will repay it from the sale proceeds. They'll then send you the balance after any mortgage, fees and other agreed costs have been paid.",
    },
    {
      title: "Keep your completion statement",
      body: "Keep your completion statement and other important sale documents somewhere safe. You may need them again in the future.",
    },
  ],
  purchaser: [
    {
      title: "Your ownership will be registered",
      body: "Your solicitor will register you as the new owner with HM Land Registry. This can take some time, but there's normally nothing you need to do.",
    },
    {
      title: "Keep your important documents",
      body: "Keep your completion statement and any other important documents from your solicitor somewhere safe. They may be useful when you eventually come to sell.",
    },
    {
      title: "Your Stamp Duty will be dealt with",
      body: "If Stamp Duty Land Tax is due, your solicitor will usually submit the return and arrange payment for you. Keep the confirmation with your other purchase documents.",
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
