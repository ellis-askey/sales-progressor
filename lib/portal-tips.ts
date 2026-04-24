export type PortalStage =
  | "onboarding"
  | "early"
  | "active"
  | "pre_exchange"
  | "exchanged"
  | "completed";

export type PortalRole = "vendor" | "purchaser";

export type PortalTip = { text: string };

const TIPS: Record<PortalStage, { both: string[]; vendor: string[]; purchaser: string[] }> = {
  onboarding: {
    both: [
      "Your solicitor will send a welcome pack and questionnaire. Return it as quickly as possible — this officially kicks off the conveyancing process.",
      "ID verification is a legal requirement. Your solicitor will need a copy of your passport or driving licence, plus a recent utility bill or bank statement dated within 3 months.",
      "The memorandum of sale is not a binding contract — either side can still pull out. The legal commitment comes much later, at exchange of contracts.",
    ],
    vendor: [
      "Start gathering documents you may need: any guarantees for works done (damp-proofing, windows, boiler service records) and your energy performance certificate.",
    ],
    purchaser: [
      "Check your mortgage agreement in principle hasn't expired — most last 90 days. Contact your broker now if it's close to expiry.",
    ],
  },
  early: {
    both: [],
    vendor: [
      "If your property is leasehold or share of freehold, a management pack has been requested from your freeholder or managing agent. These can take 4–8 weeks — this is one of the most common causes of delays.",
      "If you're also buying, keep in close contact with your agent and solicitor about both transactions. Chains move at the speed of the slowest link.",
    ],
    purchaser: [
      "Searches are ordered by your solicitor and typically take 2–6 weeks depending on the local authority. There's nothing you need to do — just be patient during this phase.",
      "Your mortgage lender will book a valuation of the property. This is not a structural survey — it's purely for the lender's purposes and won't tell you anything about the condition of the property.",
      "Consider booking an independent survey. A RICS HomeBuyer Report (Level 2) costs around £400–700 and covers the condition of the property in detail — something the lender's valuation does not do. It's there for your peace of mind.",
    ],
  },
  active: {
    both: [
      "Enquiries are raised in rounds — your solicitor may come back with follow-up questions after the first replies arrive. This is completely normal and doesn't indicate a problem.",
      "The quickest thing you can do to speed up your transaction is reply to any requests from your solicitor within 24 hours. Delays compound — a 3-day delay often becomes 2 weeks.",
    ],
    vendor: [
      "Always channel legal questions through your solicitor — avoid discussing the legal side of the transaction directly with the buyer, as this can cause confusion and complications.",
    ],
    purchaser: [
      "Once search results arrive, your solicitor will review them and flag anything that needs attention. Most searches come back clean, but they may raise points worth querying.",
      "Your mortgage offer should follow the lender's valuation within a week or two. Double-check the interest rate and repayment term match what you agreed with your broker.",
    ],
  },
  pre_exchange: {
    both: [
      "Exchange of contracts is the legal moment of commitment. After exchange, neither side can withdraw without financial penalty — typically 10% of the purchase price.",
      "The completion date is agreed by both parties before exchange and becomes legally binding the moment contracts exchange. Make sure your removal company and any chain links can confirm the date.",
    ],
    vendor: [
      "Your solicitor will send you the contract to sign before exchange. Check the completion date, price, and included fixtures match what was agreed.",
    ],
    purchaser: [
      "Transfer your deposit to your solicitor a few days before exchange — it needs to be cleared funds in their client account before exchange can happen.",
      "Arrange buildings insurance to start from the moment of exchange, not completion. From exchange, the legal risk of the property passes to you as buyer.",
    ],
  },
  exchanged: {
    both: [
      "You are now legally committed. The completion date is fixed and binding — neither party can withdraw without significant financial consequence.",
      "On completion day, your solicitor manages the transfer of funds electronically. You don't need to be at the property — but keep your phone on in case they need to reach you.",
    ],
    vendor: [
      "Leave manuals, warranties, and service records for any appliances or installations at the property. Your buyer is entitled to these. It's also good practice to leave a note with meter readings.",
      "Your solicitor will redeem your mortgage from the completion funds. Expect a letter from your lender confirming redemption within a few weeks of completion.",
    ],
    purchaser: [
      "If you haven't already booked your removal firm, now's the time — the best firms often book up 3–4 weeks ahead.",
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
    "Keep your completion statement in a safe place — you may need it for future tax purposes.",
  ],
  purchaser: [
    "Your solicitor will register your ownership at HM Land Registry. This can take several months but they manage it — you'll receive a copy of the title register when done.",
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

export function detectStage(
  milestones: Array<{ code: string; isComplete: boolean }>,
  side: PortalRole
): PortalStage {
  const done = new Set(milestones.filter((m) => m.isComplete).map((m) => m.code));

  const exchangeCode   = side === "vendor" ? "VM12" : "PM16";
  const completionCode = side === "vendor" ? "VM13" : "PM17";
  const instructCode   = side === "vendor" ? "VM1"  : "PM1";
  const searchCode     = "PM9";
  const contractCode   = side === "vendor" ? "VM5"  : "PM3";
  const enquiriesDoneCode = side === "vendor" ? "VM9"  : "PM25";
  const contractDocsCode  = side === "vendor" ? "VM10" : "PM13";

  if (done.has(completionCode)) return "completed";
  if (done.has(exchangeCode))   return "exchanged";
  if (done.has(enquiriesDoneCode) || done.has(contractDocsCode)) return "pre_exchange";
  if (done.has(searchCode) || done.has(contractCode)) return "active";
  if (done.has(instructCode)) return "early";
  return "onboarding";
}
