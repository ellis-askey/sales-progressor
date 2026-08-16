// Client-facing copy for portal milestone display
// Labels and descriptions written from the buyer/seller's perspective

export type RecipientEmailCopy = {
  subject: string;           // personalised inbox subject line
  heroLabel: string;         // what appears in the email header
  opening: string;           // first sentence — sets emotional register
  whatHappened: string;      // 1–3 sentences in the recipient's frame
  whatNext: string | null;   // forward-looking paragraph; null if not meaningful for this recipient
  action: string | null;     // CTA button label; null = no direct action
};

export type MilestoneEmailCopy = {
  vendor?: RecipientEmailCopy;
  purchaser?: RecipientEmailCopy;
  vendorAgent?: RecipientEmailCopy;
  vendorAgentPortal?: RecipientEmailCopy;
  progressor?: RecipientEmailCopy;
};

export type PortalCopy = {
  label: string;
  labelOther?: string;  // third-person version shown when the other party views this milestone
  // Used by the client-chase digest when this milestone appears as a bullet
  // under "sitting with your solicitor / lender" (NUDGE) or "Yours to do"
  // (DIY-passive). Phrased to describe the awaited action rather than a
  // past-tense state. Falls back to `label` when unset.
  chaseLabel?: string;
  who: "you" | "solicitor" | "agent" | "lender";
  typicalDuration?: string;
  description?: string;
  // Forward-looking line shown under the "Confirm this step" button on the
  // overview: what happens once the client confirms THIS step. Only client-
  // confirmable steps have one; agent-only steps omit it.
  next?: string;
  emailCopy?: MilestoneEmailCopy;
};

const TITLE_PREFIXES = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "rev", "sir", "lord", "lady"]);

export function buildGreeting(name: string | null | undefined): string {
  if (!name?.trim()) return "Hello,";
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "Hello,";

  const first = words[0].replace(/\.$/, ""); // strip trailing dot (e.g. "Dr.")
  const isTitle = TITLE_PREFIXES.has(first.toLowerCase());

  if (!isTitle) return `Hi ${words[0]},`;
  if (words.length === 1) return "Hello,"; // title only — no name to use
  if (words.length === 2) return `Hi ${words[0]} ${words[1]},`; // "Mr Smith"
  return `Hi ${words[1]},`; // "Mr John Smith" — use first name
}

const copy: Record<string, PortalCopy> = {
  // ── Vendor milestones (VM1–VM20) ─────────────────────────────────────────

  VM1: {
    label: "Instruct your solicitor", labelOther: "Seller instructed their solicitor", who: "you",
    description: "Formally appoint a solicitor to handle the legal side of your sale. Contact them to confirm your instruction and they'll begin the initial legal work.",
    next: "We'll issue the memorandum of sale to formally start the legal process.",
    emailCopy: {
      vendor: {
        subject: "You've instructed your solicitor: {address}",
        heroLabel: "Solicitor instructed",
        opening: "You've taken the first step.",
        whatHappened: "You've formally instructed your solicitor to act on the sale. They'll now start the conveyancing process, which involves preparing the contract pack, gathering title documents, and handling any questions that come in from the buyer's solicitor.",
        whatNext: "Your solicitor will prepare the contract pack and, if the property is leasehold, request the management pack from your freeholder or managing agent. This typically takes a few weeks. We'll be in touch when there's a meaningful update.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has instructed their solicitor: {address}",
        heroLabel: "Seller's solicitor instructed",
        opening: "Good news on your purchase.",
        whatHappened: "The seller has formally instructed their solicitor to act on the sale. This is an important early step. Things are now moving on the seller's side of the transaction.",
        whatNext: "Nothing for you to do right now. The seller's solicitor will prepare the contract pack and send it to your solicitor in the coming weeks. We'll let you know when that happens.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM1 complete: Seller instructed solicitor at {address}",
        heroLabel: "VM1: Seller instructed solicitor",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed solicitor instruction.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM2: {
    label: "Receive memorandum of sale", labelOther: "Seller received memorandum of sale", chaseLabel: "Confirm the memorandum of sale has arrived", who: "you",
    description: "We'll issue a memorandum of sale to everyone involved, confirming the agreed price, buyer, seller and solicitors. This formally starts the legal process.",
    next: "Your solicitor will send you a welcome pack to complete and return.",
    emailCopy: {
      vendor: {
        subject: "Memorandum of sale issued: {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed price and the details of both parties. This is the document that formally kicks off conveyancing.",
        whatNext: "Your solicitor will now begin preparing the contract pack. Returning your solicitor's welcome pack quickly is the single biggest thing you can do this week to keep the transaction moving.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Memorandum of sale issued: {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to proceed.",
        whatNext: "If you haven't already, return your solicitor's welcome pack and complete your ID checks. Your solicitor can't get fully started until these are done. If you're buying with a mortgage, also make sure your application is progressing.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM2 complete: MoS received at {address}",
        heroLabel: "VM2: MoS received",
        opening: "Logged on {address}.",
        whatHappened: "Memorandum of sale confirmed received by vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM3: {
    label: "Receive welcome pack from solicitor", labelOther: "Seller received welcome pack from solicitor", chaseLabel: "Confirm the welcome pack from your solicitor has arrived", who: "you",
    description: "Your solicitor will send you a welcome pack containing their terms of business, initial questionnaires and requirements. Complete and return everything promptly so they can begin acting for you.",
    next: "Your solicitor will complete the identity and anti-money laundering checks required before they can act for you.",
    emailCopy: {
      purchaser: {
        subject: "Seller is engaging with their solicitor: {address}",
        heroLabel: "Seller received welcome pack",
        opening: "Quick update on your purchase.",
        whatHappened: "The seller has received their welcome pack from their solicitor, the kick-off paperwork for conveyancing on their side.",
        whatNext: "Nothing for you to do right now. The seller will return the forms to their solicitor in due course.",
        action: "View your portal",
      },
      vendor: {
        subject: "Welcome pack received from your solicitor: {address}",
        heroLabel: "Welcome pack received",
        opening: "Your solicitor has made contact.",
        whatHappened: "Your solicitor has sent you their welcome pack. It contains their terms of business, a property questionnaire, and details of what ID they need from you. Returning this quickly is one of the best things you can do to keep the transaction moving.",
        whatNext: "Complete the forms and return them as soon as you can, ideally within a few days. Your solicitor cannot begin substantive work until these are back with them.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM3 complete: Seller received welcome pack at {address}",
        heroLabel: "VM3: Seller received welcome pack",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed receipt of solicitor's welcome pack.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM4: {
    label: "Complete ID & AML checks", labelOther: "Seller completed ID & AML checks", who: "you",
    description: "Your solicitor will need to verify your identity before they can act for you. You'll usually need to provide photo ID and a recent proof of address.",
    next: "Your solicitor will send you the property information forms to complete.",
    emailCopy: {
      purchaser: {
        subject: "Seller's ID checks complete: {address}",
        heroLabel: "Seller's ID & AML complete",
        opening: "Good news on your purchase.",
        whatHappened: "The seller has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the sale.",
        whatNext: "Nothing for you to do right now. This is one of the early signals that things are moving properly on the seller's side.",
        action: "View your portal",
      },
      vendor: {
        subject: "ID checks complete: {address}",
        heroLabel: "ID & AML checks done",
        opening: "You've cleared an important legal requirement.",
        whatHappened: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This clears the way for them to begin substantive work on your behalf.",
        whatNext: "Your solicitor will now continue preparing the contract pack. Worth flagging: if you haven't yet returned your property information forms when you receive them, do so promptly. Delays here are one of the main things that slow transactions down.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM4 complete: Seller ID checks done at {address}",
        heroLabel: "VM4: Seller ID & AML complete",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed completion of ID and AML verification.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM5: {
    label: "Receive property information forms", labelOther: "Seller received property information forms", chaseLabel: "Confirm the property information forms have arrived", who: "you",
    description: "Your solicitor will send you forms about the property, including the TA6 Property Information Form and TA10 Fittings and Contents Form. These cover things such as boundaries, alterations, disputes and what's included in the sale.",
    next: "Complete the forms carefully and return them to your solicitor.",
    emailCopy: {
      purchaser: {
        subject: "Seller is gathering property information: {address}",
        heroLabel: "Property forms in progress",
        opening: "Quick update on your purchase.",
        whatHappened: "The seller has been sent their property information forms (TA6 and TA10) by their solicitor. These capture details about the property's history, what's included in the sale, and any planning or dispute history.",
        whatNext: "Nothing for you to do right now. The seller will complete and return these to their solicitor in the coming days.",
        action: "View your portal",
      },
      vendor: {
        subject: "Property information forms received: {address}",
        heroLabel: "Property forms to complete",
        opening: "Your solicitor needs information from you.",
        whatHappened: "Your solicitor has sent you the property information forms (TA6 and TA10). These ask about the property's history, what's included in the sale, any disputes or planning permissions, and more. The buyer's solicitor will rely on your answers.",
        whatNext: "Complete the forms as thoroughly and accurately as you can. These are legal documents. Return them to your solicitor promptly. If you're unsure about any question, call your solicitor before leaving it blank.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM5 complete: Seller received property forms at {address}",
        heroLabel: "VM5: Seller received property forms",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed receipt of TA6/TA10 property information forms.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM6: {
    label: "Return completed property forms", labelOther: "Seller returned completed property forms", who: "you",
    description: "Complete and return the property information forms to your solicitor. They'll use these, along with the other legal documents, to prepare the contract pack for the buyer's solicitor.",
    next: "Your solicitor will prepare and issue the draft contract pack to the buyer's solicitor.",
    emailCopy: {
      vendor: {
        subject: "Property forms returned to your solicitor: {address}",
        heroLabel: "Property forms returned",
        opening: "Your forms are back with your solicitor.",
        whatHappened: "Your completed property information forms have been received by your solicitor. They'll now incorporate these into the contract pack and send everything to the buyer's solicitor.",
        whatNext: "Your solicitor will issue the draft contract pack to the buyer's solicitor. We'll let you know when that's done.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has returned their property information forms: {address}",
        heroLabel: "Property forms returned",
        opening: "Progress on your purchase.",
        whatHappened: "The seller has returned their completed property information forms to their solicitor. These will be included in the contract pack that comes to your solicitor.",
        whatNext: "Nothing to do from your side right now. The seller's solicitor will now finalise the contract pack and send it across.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM6 complete: Seller returned property forms at {address}",
        heroLabel: "VM6: Seller returned property forms",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed return of completed TA6/TA10 forms to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM7: {
    label: "Draft contract pack issued", chaseLabel: "Draft contract pack going out to the buyer's side", who: "solicitor",
    description: "Your solicitor will send the draft contract pack to the buyer's solicitor. This usually includes the draft contract, title documents, property information forms and any relevant supporting documents.",
    next: "If the property is leasehold or managed, your solicitor will request the management pack.",
    emailCopy: {
      vendor: {
        subject: "Draft contract pack sent to the buyer's solicitor: {address}",
        heroLabel: "Contract pack issued",
        opening: "A significant step forward.",
        whatHappened: "Your solicitor has sent the draft contract pack to the buyer's solicitor. This is the bundle of documents that forms the legal foundation of the sale: the contract itself, your property information forms, title documents, and any relevant certificates.",
        whatNext: "The buyer's solicitor will now review everything carefully and is likely to raise enquiries, meaning questions about the property and the documents. Your solicitor will handle these, though they may need your input on some points.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The contract pack has arrived with your solicitor: {address}",
        heroLabel: "Contract pack received",
        opening: "Things are moving on your purchase.",
        whatHappened: "The seller's solicitor has sent the contract pack to your solicitor. This is the full bundle of legal documents: the draft contract, title documents, property information forms, and more. Your solicitor will now review everything in detail.",
        whatNext: "Your solicitor will go through the contract pack and raise any questions that need answering. In the meantime, make sure your mortgage application is progressing and any searches have been ordered.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Contract pack issued: {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Seller's solicitor has issued the draft contract pack to the buyer's solicitor.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM7 complete: Contract pack issued at {address}",
        heroLabel: "VM7: Draft contract pack issued",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has issued draft contract pack to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM8: {
    label: "Management pack requested", chaseLabel: "Management pack request going to the freeholder", who: "solicitor",
    description: "If the property is leasehold or managed, your solicitor will request a management pack from the freeholder, managing agent or management company. It contains important information about the management of the property and associated charges.",
    next: "The freeholder, managing agent or management company will prepare and return the management pack.",
    emailCopy: {
      purchaser: {
        subject: "Leasehold information requested: {address}",
        heroLabel: "Management pack requested",
        opening: "Quick update on your purchase.",
        whatHappened: "The seller's solicitor has requested the management pack from the freeholder or managing agent. This contains the leasehold information your solicitor will need: service charges, ground rent, building insurance, and any planned major works.",
        whatNext: "Management packs sometimes take a few weeks to come back, but this is now in motion. Nothing for you to do right now.",
        action: "View your portal",
      },
      vendor: {
        subject: "Management pack requested from your freeholder: {address}",
        heroLabel: "Management pack requested",
        opening: "Leasehold paperwork is underway.",
        whatHappened: "Your solicitor has requested the management pack from your freeholder or managing agent. This pack contains the leasehold information the buyer's solicitor will need: service charge accounts, ground rent history, building insurance, and details of any planned major works.",
        whatNext: "Management packs can take a while, typically several weeks, sometimes longer. Worth noting: freeholders usually charge a fee for providing the pack, which will be deducted from your sale proceeds at completion. We'll let you know as soon as it arrives.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM8 complete: Management pack requested at {address}",
        heroLabel: "VM8: Management pack requested",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has requested management pack from freeholder/managing agent.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM9: {
    label: "Management pack received", chaseLabel: "Management pack coming back from the freeholder", who: "solicitor", typicalDuration: "can take 4–8 weeks",
    description: "Your solicitor will receive the management pack containing information such as service charges, ground rent, building insurance and any planned major works. They'll review it before providing it to the buyer's solicitor.",
    next: "The buyer's solicitor will review the legal documents and raise any enquiries they have about the property.",
    emailCopy: {
      vendor: {
        subject: "Management pack received: {address}",
        heroLabel: "Management pack received",
        opening: "The leasehold paperwork has arrived.",
        whatHappened: "The management pack has been received from your freeholder or managing agent. Your solicitor will now review the leasehold information (service charges, ground rent, building insurance, and any planned works) before sending it to the buyer's solicitor.",
        whatNext: "This is often one of the longer waits in a leasehold transaction, so receiving it is real progress. Your solicitor will incorporate the pack into the contract pack and send it across to the buyer's side.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Management pack received on your purchase: {address}",
        heroLabel: "Management pack received",
        opening: "Good news on the leasehold side.",
        whatHappened: "The management pack from the freeholder has arrived and is being reviewed. This contains the leasehold information your solicitor needs: service charges, ground rent, building insurance, and details of any planned major works to the building.",
        whatNext: "Your solicitor will review the management pack carefully and raise any points with the seller's solicitor as part of the enquiries process.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM9 complete: Management pack received at {address}",
        heroLabel: "VM9: Management pack received",
        opening: "Logged on {address}.",
        whatHappened: "Management pack confirmed received by vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM10: {
    label: "Initial enquiries received", chaseLabel: "Buyer's initial enquiries arriving", who: "solicitor",
    description: "The buyer's solicitor will raise questions about the property and the legal documents provided. These may relate to the title, alterations, boundaries, planning matters or anything else that requires clarification.",
    next: "Your solicitor will work through the enquiries and may need information or documents from you to answer them.",
    emailCopy: {
      // E1 (enquiries rework): VM10 is vendor-only. The buyer hears about this
      // same event once, via PM14 (raised), so the purchaser block is dropped
      // to avoid a duplicate email on matched files.
      vendor: {
        subject: "Buyer's enquiries received: {address}",
        heroLabel: "Enquiries received",
        opening: "The buyer's solicitor has questions.",
        whatHappened: "The buyer's solicitor has raised their first round of enquiries: questions about the property and the documents in the contract pack. This is a completely normal part of the process. Your solicitor will work through them and may need your input on some points.",
        whatNext: "If your solicitor contacts you asking for information to help answer the enquiries, please respond as quickly as you can. Delays in enquiries are one of the most common reasons transactions slow down.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM10 complete: Initial enquiries received at {address}",
        heroLabel: "VM10: Initial enquiries received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised initial enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM11: {
    label: "Provide replies to enquiries", labelOther: "Seller provided replies to enquiries", who: "you",
    description: "Your solicitor needs your input to answer some of the buyer's questions. Respond as quickly as you can. Delays in enquiries are one of the most common reasons transactions stall.",
    emailCopy: {
      purchaser: {
        subject: "Seller has answered your solicitor's questions: {address}",
        heroLabel: "Seller provided replies",
        opening: "Progress on your purchase.",
        whatHappened: "The seller has provided their solicitor with the information needed to reply to your solicitor's enquiries. The seller's solicitor will now formally send the replies across.",
        whatNext: "Nothing for you to do right now. Your solicitor will let you know once the replies are in their hands.",
        action: "View your portal",
      },
      vendor: {
        subject: "Replies to enquiries provided: {address}",
        heroLabel: "Enquiry replies provided",
        opening: "Good progress on your sale.",
        whatHappened: "You've provided your solicitor with the information they need to prepare replies to the buyer's enquiries.",
        whatNext: "Your solicitor will compile the formal replies and send them to the buyer's solicitor. We'll let you know when they're across.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM11 complete: Seller provided enquiry replies at {address}",
        heroLabel: "VM11: Seller provided replies",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed they've provided replies to solicitor for initial enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM12: {
    label: "Replies sent to buyer's solicitor", chaseLabel: "Replies going back to the buyer's side", who: "solicitor",
    description: "Your solicitor has sent replies to the buyer's enquiries. The buyer's solicitor will review these and may raise further questions.",
    emailCopy: {
      vendor: {
        subject: "Enquiry replies sent to the buyer's solicitor: {address}",
        heroLabel: "Replies sent",
        opening: "Your solicitor has replied to the enquiries.",
        whatHappened: "Your solicitor has sent their replies to the buyer's solicitor's initial enquiries. The buyer's solicitor will now review these and may come back with further questions. This is completely normal.",
        whatNext: "There's nothing for you to do right now. If another round of questions arrives, we'll let you know.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has replied to your solicitor's enquiries: {address}",
        heroLabel: "Enquiry replies received",
        opening: "Progress on the enquiries.",
        whatHappened: "The seller's solicitor has sent replies to your solicitor's initial enquiries. Your solicitor will now review the answers and decide whether any further questions are needed.",
        whatNext: "Your solicitor will let you know if anything in the replies needs your attention. Otherwise, they'll continue working through the remaining points before you move towards exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM12 complete: Initial replies sent to buyer's solicitor at {address}",
        heroLabel: "VM12: Initial replies sent",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has sent initial enquiry replies to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM13: {
    label: "Additional enquiries received", chaseLabel: "Buyer's additional enquiries arriving", who: "solicitor",
    description: "A second round of questions has arrived from the buyer's solicitor. This is completely normal. Most transactions have at least two rounds of enquiries.",
    emailCopy: {
      purchaser: {
        subject: "Your further questions are with the seller's side: {address}",
        heroLabel: "Further enquiries received",
        opening: "Quick update on your purchase.",
        whatHappened: "The further enquiries your solicitor raised have been received by the seller's solicitor. They'll now work through the additional points with the seller.",
        whatNext: "Nothing for you to do right now.",
        action: "View your portal",
      },
      vendor: {
        subject: "Additional enquiries from the buyer: {address}",
        heroLabel: "Further enquiries received",
        opening: "Another round of questions.",
        whatHappened: "Most transactions go through at least two rounds of enquiries before all questions are resolved. Your solicitor will work through these and may need your input on some points.",
        whatNext: "Your solicitor will work through these. If they need your input on any points, they'll be in touch. Please respond as promptly as you can.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM13 complete: Additional enquiries received at {address}",
        heroLabel: "VM13: Additional enquiries received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM14: {
    label: "Provide additional replies", labelOther: "Seller provided additional replies", who: "you",
    description: "Your solicitor needs your help with another set of questions from the buyer. Answer them as soon as possible to keep the transaction moving.",
    emailCopy: {
      purchaser: {
        subject: "Seller has answered the further questions: {address}",
        heroLabel: "Additional replies provided",
        opening: "Progress on your purchase.",
        whatHappened: "The seller has provided their solicitor with answers to the additional enquiries your solicitor raised. The seller's solicitor will now send these replies across.",
        whatNext: "Nothing for you to do right now.",
        action: "View your portal",
      },
      vendor: {
        subject: "Additional replies provided: {address}",
        heroLabel: "Additional replies provided",
        opening: "Good progress on your sale.",
        whatHappened: "You've given your solicitor the additional information needed to reply to the buyer's further enquiries.",
        whatNext: "Your solicitor will compile and send the additional replies to the buyer's solicitor.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM14 complete: Seller provided additional replies at {address}",
        heroLabel: "VM14: Seller provided additional replies",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed they've provided replies to solicitor for additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM15: {
    label: "Additional replies sent", chaseLabel: "Additional replies going back to the buyer's side", who: "solicitor",
    description: "Your solicitor has replied to the additional enquiries. Once both solicitors are satisfied, you're moving towards exchange.",
    emailCopy: {
      vendor: {
        subject: "All enquiry replies sent, moving towards exchange: {address}",
        heroLabel: "All replies sent",
        opening: "The enquiries are behind you.",
        whatHappened: "Your solicitor has sent replies to all outstanding enquiries from the buyer's solicitor. Both sides are now working towards exchange of contracts.",
        whatNext: "The next steps are your solicitor sending you the contract to sign and confirming they're ready to exchange. We'll be in touch when there's an update.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has replied to all enquiries: {address}",
        heroLabel: "All replies received",
        opening: "The enquiry stage is winding up.",
        whatHappened: "The seller's solicitor has replied to all of your solicitor's enquiries. Your solicitor will now review the additional replies and work through any remaining outstanding points.",
        whatNext: "Once your solicitor is satisfied with all the replies, they'll prepare their final report to you and confirm they're ready to move towards exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM15 complete: Additional replies sent to buyer's solicitor at {address}",
        heroLabel: "VM15: Additional replies sent",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has sent additional enquiry replies to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM16: {
    label: "Contract documents issued to you", labelOther: "Contract documents issued to seller", chaseLabel: "Confirm the contract documents have arrived", who: "you",
    description: "Your solicitor will send you the contract documents to review and sign. Check the sale price and other details carefully before signing.",
    next: "Sign and return the contract documents to your solicitor so they can hold them ready for exchange.",
    emailCopy: {
      purchaser: {
        subject: "Seller has received their contract: {address}",
        heroLabel: "Seller's contract issued",
        opening: "Good news on your purchase.",
        whatHappened: "The seller has received their contract documents to review and sign. This is an important step. The transaction is closing in on exchange.",
        whatNext: "Nothing for you to do right now. We'll let you know once the seller has signed and returned their contract.",
        action: "View your portal",
      },
      vendor: {
        subject: "Your contract is ready to sign: {address}",
        heroLabel: "Contract ready to sign",
        opening: "Your contract documents have arrived.",
        whatHappened: "Your solicitor has sent you the contract documents to review and sign. This is an important step. You're on the way to exchange of contracts.",
        whatNext: "Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Your solicitor will explain exactly what signing means and what you're committing to. Exchange is the legally binding moment. Once you're happy, sign and return it.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM16 complete: Contract issued to seller at {address}",
        heroLabel: "VM16: Contract issued to seller",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has issued contract documents to the vendor for signature.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM17: {
    label: "Sign and return contract documents", labelOther: "Seller signed and returned contract", who: "you",
    description: "Sign and return the contract documents to your solicitor. Signing does not make the sale legally binding; that happens when contracts are exchanged.",
    next: "Once both sides and the rest of the chain are ready, we'll coordinate a completion date and work towards exchange.",
    emailCopy: {
      purchaser: {
        subject: "Seller has signed the contract: {address}",
        heroLabel: "Seller signed contract",
        opening: "A significant step on your purchase.",
        whatHappened: "The seller has signed and returned their contract documents to their solicitor. Both sides need signed contracts in their solicitors' hands before exchange can happen.",
        whatNext: "Once your contract is also signed and returned, exchange can be coordinated.",
        action: "View your portal",
      },
      vendor: {
        subject: "Signed contract received, ready for exchange: {address}",
        heroLabel: "Contract signed and returned",
        opening: "Your signed contract is with your solicitor.",
        whatHappened: "Your solicitor has received your signed contract documents and is holding them ready for exchange. They will have explained the commitment this represents: the legally binding moment is exchange, not signing.",
        whatNext: "Once the buyer's solicitor also confirms ready, your solicitors will coordinate exchange and agree a completion date. We can help facilitate if needed.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Seller signed and returned contract: {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Seller has signed and returned their contract to their solicitor.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM17 complete: Seller signed and returned contract at {address}",
        heroLabel: "VM17: Seller signed contract",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed signed contract returned to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM18: {
    label: "Solicitor confirms ready to exchange", who: "solicitor", typicalDuration: "typically 1–5 days after signing",
    description: "Your solicitor will confirm once everything is in place for you to exchange contracts. We'll then coordinate with the buyer's side and the rest of the chain to get everyone ready to exchange.",
    emailCopy: {
      vendor: {
        subject: "Your solicitor is ready to exchange: {address}",
        heroLabel: "Ready to exchange",
        opening: "Your solicitor has confirmed they're ready.",
        whatHappened: "Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the buyer's side is ready too.",
        whatNext: "We're now working to ensure the buyer's side is also ready to exchange. Once both solicitors confirm, exchange can be arranged quickly. Make sure you're reachable.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller's solicitor is ready to exchange: {address}",
        heroLabel: "Seller ready to exchange",
        opening: "The seller's side is ready.",
        whatHappened: "The seller's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.",
        whatNext: "Make sure your deposit is in your solicitor's client account as cleared funds, and that your signed contract has been returned. We'll be in touch as soon as exchange is confirmed.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM18 complete: Vendor solicitor ready to exchange at {address}",
        heroLabel: "VM18: Vendor solicitor ready to exchange",
        opening: "Logged on {address}.",
        whatHappened: "Vendor's solicitor has confirmed readiness to exchange.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM19: {
    label: "Contracts exchanged", who: "agent",
    description: "Your solicitor will exchange contracts with the buyer's solicitor, making the sale legally binding and fixing the completion date. After exchange, neither you nor the buyer can withdraw without potentially significant financial consequences.",
    emailCopy: {
      vendor: {
        subject: "Contracts exchanged, your sale is legally committed: {address}",
        heroLabel: "Contracts exchanged",
        opening: "Contracts have exchanged on your sale.",
        whatHappened: "Both solicitors have formally exchanged signed contracts, and the sale is now legally binding. Neither side can withdraw without significant financial penalty. The completion date is now fixed.",
        whatNext: "Between now and completion, you should arrange to have everything ready to leave the property by the agreed time on completion day. Your solicitor will manage the legal transfer of funds. You'll hear from them on the day.",
        action: "View your portal",
      },
      // VM19.purchaser intentionally absent — the buyer is notified via PM26
      // (auto-completed as VM19's bilateral counterpart in
      // app/actions/milestones.ts:69 and lib/services/portal.ts:303). The
      // FINAL VM19 skeleton is vendor-only by design. Removing the legacy
      // fallback prevents the assembler from double-sending an exchange
      // email to the buyer.
      vendorAgent: {
        subject: "Exchange confirmed: {address}",
        heroLabel: "Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts have exchanged. Both parties are now legally committed. Completion is set for {completionDate}.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM19 complete: Contracts exchanged at {address}",
        heroLabel: "VM19: Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts exchanged. Both parties legally committed. Completion date fixed. Reconcile any outstanding milestones and confirm the completion date is recorded.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM20: {
    label: "Sale completed", who: "agent",
    description: "On completion day, the buyer's solicitor will transfer the purchase funds to your solicitor. Your solicitor will settle any mortgage secured against the property and deal with the remaining funds due to you. Once completion is confirmed, the keys can be released to the buyer.",
    emailCopy: {
      vendor: {
        subject: "Sale complete, congratulations: {address}",
        heroLabel: "Sale complete",
        opening: "Congratulations. It's done.",
        whatHappened: "Your sale has completed. The purchase funds have been transferred, your mortgage has been redeemed by your solicitor, and ownership of the property has transferred to the buyer. The sale is legally concluded.",
        whatNext: "Your solicitor will send you a completion statement showing the final figures. If you're also buying, the net proceeds will be passed to your purchase solicitor. Keep your completion statement safely for your records. You may need it for tax purposes.",
        action: "View your portal",
      },
      // VM20.purchaser intentionally absent — the buyer is notified via PM27
      // (auto-completed as VM20's bilateral counterpart). The FINAL VM20
      // skeleton is vendor-only by design. Removing the legacy fallback
      // prevents the assembler from double-sending a completion email to
      // the buyer.
      vendorAgent: {
        subject: "Completion confirmed: {address}",
        heroLabel: "Sale completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Sale completed on {address}. If you haven't already, contact your vendor and buyer to confirm completion and coordinate key handover with the buyer.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM20 complete: Sale completed at {address}",
        heroLabel: "VM20: Sale completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Sale completed. Transaction closed. Reconcile any outstanding milestones and confirm all fees are recorded.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  // ── Purchaser milestones (PM1–PM27) ──────────────────────────────────────

  PM1: {
    label: "Instruct your solicitor", labelOther: "Buyer instructed their solicitor", who: "you",
    description: "Formally appoint a solicitor to handle the conveyancing for your purchase. Contact them to confirm your instruction. They'll send you a welcome pack and begin the legal work.",
    next: "We'll issue the memorandum of sale to formally start the legal process.",
    emailCopy: {
      purchaser: {
        subject: "You've instructed your solicitor: {address}",
        heroLabel: "Solicitor instructed",
        opening: "You've taken the first step.",
        whatHappened: "You've formally instructed your solicitor to act on your purchase. They'll now contact you with a welcome pack, their terms of business, and details of what they need from you to get started.",
        whatNext: "Return your solicitor's welcome pack and complete your ID checks as quickly as possible. Your solicitor cannot begin substantive work until these are in place. We'll update you when there's meaningful progress.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer has instructed their solicitor: {address}",
        heroLabel: "Buyer's solicitor instructed",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has formally instructed their solicitor to act on the purchase. Conveyancing is now underway on the buyer's side.",
        whatNext: "Nothing for you to do right now. We'll keep you updated as both sides progress.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM1 complete: Buyer instructed solicitor at {address}",
        heroLabel: "PM1: Buyer instructed solicitor",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed solicitor instruction.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM2: {
    label: "Receive memorandum of sale", labelOther: "Buyer received memorandum of sale", chaseLabel: "Confirm the memorandum of sale has arrived", who: "you",
    description: "We'll issue a memorandum of sale to everyone involved, confirming the agreed price, buyer, seller and solicitors. This formally starts the legal process.",
    next: "Your solicitor will complete the identity and anti-money laundering checks required before they can act for you.",
    emailCopy: {
      purchaser: {
        subject: "Memorandum of sale issued: {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to begin conveyancing.",
        whatNext: "If you haven't already, return your solicitor's welcome pack and complete your ID checks. Your solicitor can't get fully started until these are done. If you're buying with a mortgage, also make sure your application is progressing.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM2 complete: MoS received at {address}",
        heroLabel: "PM2: MoS received",
        opening: "Logged on {address}.",
        whatHappened: "Memorandum of sale confirmed received by buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM3: {
    label: "Complete ID & AML checks", labelOther: "Buyer completed ID & AML checks", who: "you",
    description: "Your solicitor will need to verify your identity and source of funds before they can act for you. You'll usually need to provide photo ID, proof of address and evidence of where your funds are coming from.",
    next: "Your solicitor will ask for an initial payment to cover searches and other upfront costs.",
    emailCopy: {
      vendor: {
        subject: "Buyer's ID checks complete: {address}",
        heroLabel: "Buyer's ID & AML complete",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has completed their ID and anti-money laundering checks. Their solicitor can now begin substantive work on the purchase.",
        whatNext: "Nothing for you to do right now. This is one of the early signals that things are moving properly on the buyer's side.",
        action: "View your portal",
      },
      purchaser: {
        subject: "ID checks complete: {address}",
        heroLabel: "ID & AML checks done",
        opening: "You've cleared an important legal requirement.",
        whatHappened: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This allows them to begin substantive work on your purchase.",
        whatNext: "Your solicitor is now able to work on your case fully. Worth flagging: if you haven't yet paid your money on account, do this as soon as possible. Your solicitor will need it before they can order searches.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM3 complete: Buyer ID checks done at {address}",
        heroLabel: "PM3: Buyer ID & AML complete",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed completion of ID and AML verification.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM4: {
    label: "Pay money on account to solicitor", labelOther: "Buyer paid money on account to solicitor", who: "you",
    description: "Your solicitor will ask for an initial payment to cover searches and other disbursements. This is separate from your purchase deposit and is typically a few hundred pounds.",
    next: "If you're buying with a mortgage, the next step is to submit your full application to your lender.",
    emailCopy: {
      vendor: {
        subject: "Buyer has put funds with their solicitor: {address}",
        heroLabel: "Buyer funds in place",
        opening: "Strong signal on your sale.",
        whatHappened: "The buyer has transferred funds to their solicitor for searches and disbursements. This is one of the clearest signals that the buyer is committed in the early stages of a transaction.",
        whatNext: "Searches will typically be ordered shortly. That's usually the next major step on the buyer's side.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Payment on account received by your solicitor: {address}",
        heroLabel: "Payment on account received",
        opening: "Thank you. Your solicitor has received your payment on account.",
        whatHappened: "Your initial payment to your solicitor has been received. This covers the cost of searches and other disbursements they'll incur on your behalf during the conveyancing process. This is separate from your deposit.",
        whatNext: "Your solicitor can now order searches and proceed with the full conveyancing process. We'll update you as each stage progresses.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM4 complete: Buyer paid money on account at {address}",
        heroLabel: "PM4: Buyer paid money on account",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed payment on account to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM5: {
    label: "Submit mortgage application", labelOther: "Buyer submitted mortgage application", who: "you",
    description: "Submit your full mortgage application to your lender, usually through your mortgage broker. This turns your agreement in principle into a formal application for this property.",
    next: "Your lender will arrange a valuation of the property as part of their assessment.",
    emailCopy: {
      vendor: {
        subject: "Buyer's mortgage application is in: {address}",
        heroLabel: "Mortgage application submitted",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer has submitted their mortgage application to their lender. The lender will now process the application. This typically includes a valuation visit to the property. We'll be in touch to coordinate access.",
        whatNext: "We'll let you know when the mortgage offer is issued.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Mortgage application submitted: {address}",
        heroLabel: "Mortgage application submitted",
        opening: "Your mortgage application is in.",
        whatHappened: "Your full mortgage application has been submitted to your lender. They'll now assess your application, arrange a valuation of the property, and work towards issuing a formal mortgage offer.",
        whatNext: "Your lender will book a valuation of the property, usually within a week or two. Once the valuation is done, the formal mortgage offer typically follows within 1 to 3 weeks. Your broker or lender will keep you updated.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM5 complete: Buyer submitted mortgage application at {address}",
        heroLabel: "PM5: Buyer submitted mortgage application",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed mortgage application submitted.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM6: {
    label: "Lender valuation booked", chaseLabel: "Valuation being booked", who: "lender", typicalDuration: "usually 1–2 weeks after application",
    description: "Your lender will arrange a valuation to check the property provides suitable security for the mortgage. This is for the lender's benefit and is not a survey of the property's condition.",
    next: "Once the valuation is complete, your lender will review your application and, if approved, issue your formal mortgage offer.",
    emailCopy: {
      vendor: {
        subject: "Buyer's lender valuation: {address}",
        heroLabel: "Lender valuation booked",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer's lender has booked the property valuation{eventDate}.{vendorVisitNote} Once the valuation is done, the buyer's mortgage offer typically follows within 1–3 weeks. We'll let you know when it's issued.",
        whatNext: null,
        action: "View your portal",
      },
      purchaser: {
        subject: "Mortgage valuation: {address}",
        heroLabel: "Lender valuation booked",
        opening: "Your mortgage lender has arranged their valuation.",
        // {attendClause} interpolates to " and will attend on Thursday 13th
        // August 2026" when a date is set, or "" for desktop valuations
        // (which leaves the sentence as "...a valuation of the property.").
        // The desktop-specific caveat is covered by the RICS HomeBuyer note
        // in whatNext, so we don't need to re-flag it here.
        whatHappened: "Your lender has arranged a valuation of the property{attendClause}.{purchaserPhysicalNote}",
        whatNext: "If you haven't already booked your own survey, now is a good time. A RICS HomeBuyer Report will identify issues the lender's valuation won't cover. Once the valuation is complete, your mortgage offer should follow within 1 to 3 weeks.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM6 complete: Lender valuation booked at {address}",
        heroLabel: "PM6: Lender valuation booked",
        opening: "Logged on {address}.",
        whatHappened: "Lender valuation confirmed booked.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM7: {
    label: "Draft contract pack received", chaseLabel: "Draft contract pack arriving from the seller's side", who: "solicitor",
    description: "The seller's solicitor will send your solicitor the draft contract pack. It usually includes the draft contract, title documents and property information forms for your solicitor to review.",
    next: "Your solicitor will order the searches and begin identifying any questions they need to raise with the seller's solicitor.",
    emailCopy: {
      purchaser: {
        subject: "Contract pack received by your solicitor: {address}",
        heroLabel: "Contract pack received",
        opening: "The legal documents are with your solicitor.",
        whatHappened: "Your solicitor has received the contract pack from the seller's solicitor. This is the bundle of documents that forms the legal foundation of the purchase: the draft contract, title documents, property information forms, and any relevant certificates. Your solicitor will now review everything carefully.",
        whatNext: "Your solicitor will work through the contract pack and raise enquiries. If you haven't already ordered searches, make sure that's in hand. Your solicitor needs your payment on account before they can do so. In parallel, keep your mortgage application and survey progressing.",
        action: "View your portal",
      },
      vendor: {
        subject: "Your contract pack has arrived with the buyer's solicitor: {address}",
        heroLabel: "Contract pack received",
        opening: "Progress on your sale.",
        whatHappened: "The contract pack has been received by the buyer's solicitor. They'll now review everything carefully and will raise any questions they have about the property or the documents.",
        whatNext: "The buyer's solicitor will raise enquiries in due course and will also order searches around this time. Your solicitor will handle the enquiries. They may need your input on some points, and we'll be in touch if so.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM7 complete: Contract pack received at {address}",
        heroLabel: "PM7: Draft contract pack received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed receipt of draft contract pack.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM8: {
    label: "Searches ordered", chaseLabel: "Searches being ordered", who: "solicitor", typicalDuration: "results in 2–4 weeks",
    description: "Your solicitor will order property searches to obtain information from the local authority, water authority and other sources about matters that could affect the property.",
    next: "Once the results are returned, your solicitor will review them alongside the other legal documents for the property.",
    emailCopy: {
      vendor: {
        subject: "Buyer's solicitor has ordered searches: {address}",
        heroLabel: "Searches ordered",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer's solicitor has submitted search applications to the local authority, water authority, and other relevant bodies. Searches check for planning permissions, flood risk, and drainage. They're a standard part of the buyer's due diligence.",
        whatNext: "Nothing for you to do. We'll keep you updated as things progress.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Searches ordered on your purchase: {address}",
        heroLabel: "Searches ordered",
        opening: "Your solicitor has ordered the searches.",
        whatHappened: "Your solicitor has submitted the search applications to the local authority, water authority, and other relevant bodies. Searches check for things like planning permissions, flood risk, drainage rights, and other factors that could affect the property.",
        whatNext: "Searches typically take 2 to 4 weeks to come back depending on the local authority. There's nothing for you to do while you wait. We'll let you know when they arrive.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM8 complete: Searches ordered at {address}",
        heroLabel: "PM8: Searches ordered",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed searches ordered.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM9: {
    label: "Book your survey", labelOther: "Buyer booked their survey", who: "you",
    description: "Arrange an independent survey to assess the condition of the property. It's for your benefit and can highlight defects, repairs or other issues that may need further investigation.",
    next: "Your surveyor will inspect the property and prepare their report.",
    emailCopy: {
      vendor: {
        subject: "Buyer has arranged their survey, {address}",
        heroLabel: "Buyer's survey arranged",
        opening: "The buyer has arranged a property survey{surveyorClause}.",
        whatHappened: "Once the surveyor has a date in mind, access to the property will be arranged in the usual way, normally through the estate agent. There's nothing you need to do at this stage. If the survey raises anything the buyer wishes to investigate further, this may be raised with your solicitor as an enquiry. If anything is needed from you, we'll be in touch.",
        whatNext: null,
        action: "View your portal",
      },
      purchaser: {
        subject: "Your survey is arranged, {address}",
        heroLabel: "Survey arranged",
        opening: "Your property survey has been arranged{surveyorClause}.",
        // {valuationNote} appends the mortgage-only "separate from the lender's
        // valuation" sentences (empty for cash buyers, who have no valuation).
        whatHappened: "The surveyor will inspect the property in person and produce a report directly for you. A Level 2 (HomeBuyer) survey typically takes 1 to 2 hours at the property, while a Level 3 (full structural) survey can take 2 to 3 hours.{valuationNote}",
        whatNext: "You can usually expect to receive the report within a week or two of the survey. Once you have it, take some time to read through it carefully. If anything significant is highlighted, it's worth speaking with your surveyor before deciding what to do next. They'll be able to explain whether a finding is something that needs attention or is fairly routine for a property of this type and age.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM9 complete: Buyer booked survey at {address}",
        heroLabel: "PM9: Buyer booked survey",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed survey booked.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM10: {
    label: "Survey report received", chaseLabel: "Confirm the survey report has arrived", who: "you",
    description: "Your surveyor will send you a report detailing the condition of the property and any issues they've identified. Read it carefully and speak to your solicitor if anything significant needs further investigation.",
    next: "Your solicitor will continue reviewing the legal information provided by the seller's solicitor.",
    emailCopy: {
      vendor: {
        subject: "Buyer's survey report is in, {address}",
        heroLabel: "Buyer's survey report received",
        opening: "The buyer has now received their survey report and will be taking some time to read through the findings.",
        whatHappened: "There's nothing you need to do at this stage. No news is generally good news when it comes to survey reports, so unless the buyer raises anything, the sale will simply continue progressing as normal.",
        whatNext: "If the buyer does need further information or documentation following the survey, this may be raised with your solicitor through the normal enquiry process. If there's anything that needs your input directly, we'll be in touch.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Your survey report is in, {address}",
        heroLabel: "Survey report received",
        opening: "Your survey report is now available.",
        whatHappened: "Take some time to read through it carefully. Surveyors generally use condition ratings to help highlight which areas need the most attention, so focus particularly on anything given a higher-risk rating or identified as requiring further investigation. If there's anything you don't understand or you're unsure how significant it is, speak with your surveyor before deciding what to do next. They'll usually be happy to talk through their findings and explain whether something is a genuine concern or a fairly routine observation for a property of this type and age.",
        whatNext: "If the report highlights anything you feel needs to be raised with the seller, such as a significant defect, further information or documentation, speak with your solicitor. It's worth deciding what you'd actually like clarified or resolved first, and your solicitor can then raise the appropriate enquiries with the seller's side.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM10 complete: Buyer received survey report at {address}",
        heroLabel: "PM10: Survey report received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed receipt of survey report.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM11: {
    label: "Mortgage offer received", chaseLabel: "Mortgage offer coming through", who: "lender", typicalDuration: "typically 1–3 weeks after valuation",
    description: "If your application is approved, your lender will issue a formal mortgage offer setting out the loan amount, interest rate, term and any conditions. Your solicitor will also receive a copy and review any legal requirements attached to it.",
    next: "If you're having your own survey, make sure it's booked so you can check the condition of the property.",
    emailCopy: {
      purchaser: {
        subject: "Your mortgage offer has arrived: {address}",
        heroLabel: "Mortgage offer received",
        opening: "Congratulations. Your mortgage is confirmed.",
        whatHappened: "Your lender has issued a formal mortgage offer. This confirms the amount they're willing to lend, the interest rate, the term, and any conditions attached. Your solicitor has received a copy and will check it against the property title.",
        whatNext: "Check the offer carefully. Confirm the loan amount, rate, and term match what you agreed with your broker or lender. If anything looks wrong, raise it immediately. Your solicitor will review the conditions and let you know if anything needs addressing.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer's mortgage offer has been issued: {address}",
        heroLabel: "Buyer's mortgage offer received",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has received their formal mortgage offer from their lender. The financing for your sale is now confirmed, a significant step towards exchange.",
        whatNext: "Nothing for you to do. The transaction is moving in the right direction on the buyer's side.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer's mortgage offer issued: {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer has received their formal mortgage offer. Financing confirmed.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM11 complete: Buyer mortgage offer received at {address}",
        heroLabel: "PM11: Mortgage offer received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed mortgage offer received from lender.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM12: {
    label: "Management pack received", chaseLabel: "Management pack arriving from the seller's side", who: "solicitor",
    description: "If the property is leasehold or managed, your solicitor will receive a management pack from the freeholder, managing agent or management company. It contains information such as service charges, ground rent, insurance and planned works.",
    next: "Your solicitor will review the management information alongside the other legal documents and raise any necessary enquiries.",
    emailCopy: {
      vendor: {
        subject: "Management pack received: {address}",
        heroLabel: "Management pack received",
        opening: "Quick update on your sale.",
        whatHappened: "The management pack from the freeholder has been received by the buyer's solicitor. They'll now review service charges, ground rent, building insurance, and any planned major works.",
        whatNext: "Nothing for you to do right now.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Management pack received: {address}",
        heroLabel: "Management pack received",
        opening: "The leasehold paperwork has arrived.",
        whatHappened: "The management pack from the freeholder has been received by your solicitor. They'll now review the service charge accounts, ground rent history, building insurance arrangements, and any planned or recent major works to the building.",
        whatNext: "Your solicitor will raise any concerns from the management pack with the seller's solicitor as part of the enquiries process. We'll let you know if anything needs your attention.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM12 complete: Management pack received at {address}",
        heroLabel: "PM12: Management pack received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed management pack received.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM13: {
    label: "Search results received", chaseLabel: "Search results coming back", who: "solicitor", typicalDuration: "usually 2–6 weeks",
    description: "Your solicitor will receive and review the search results for anything that could affect the property or your purchase. Any issues that need clarification can then be raised with the seller's solicitor.",
    next: "Your solicitor will raise any outstanding enquiries with the seller's solicitor.",
    emailCopy: {
      vendor: {
        subject: "Buyer's search results are back: {address}",
        heroLabel: "Search results received",
        opening: "Quick update on your sale.",
        whatHappened: "The search results have been received by the buyer's solicitor. Searches cover planning, flood risk, drainage, and other local factors.",
        whatNext: "Nothing for you to do. Most searches come back without issue. We'll let you know if anything needs attention.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Search results back: {address}",
        heroLabel: "Search results received",
        opening: "Your searches have come back.",
        whatHappened: "The search results have been received from the local authority and other bodies. Your solicitor will now review them carefully. They cover planning permissions, flood risk, drainage, and other factors affecting the property.",
        whatNext: "Most searches come back with nothing of concern. If your solicitor does identify something worth discussing, they'll be in touch. Otherwise, this keeps things moving towards exchange.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer's search results received: {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer's solicitor has confirmed search results received. Conveyancing progressing.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM13 complete: Search results received at {address}",
        heroLabel: "PM13: Search results received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed search results received.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM14: {
    label: "Initial enquiries raised", chaseLabel: "Initial enquiries going out to the seller's side", who: "solicitor",
    description: "Your solicitor will raise questions with the seller's solicitor about the property, title and documents provided. This is a normal part of the legal process and helps ensure everything is in order before you exchange.",
    next: "The seller's solicitor will respond to the enquiries. Your solicitor may raise further questions until they're satisfied with the replies.",
    emailCopy: {
      // E1 (enquiries rework): PM14 is purchaser-only. On a matched file the
      // seller hears about this same event once, via VM10 (received), so the
      // vendor block is intentionally dropped to avoid a duplicate email.
      purchaser: {
        subject: "Your solicitor has raised enquiries: {address}",
        heroLabel: "Enquiries raised",
        opening: "Enquiries are now with the seller's solicitor.",
        whatHappened: "Your solicitor has raised their first round of enquiries with the seller's solicitor: questions about the property, the title, and the documents in the contract pack. This is a completely normal and important part of the conveyancing process.",
        whatNext: "This stage can take a few weeks, and it's normal for things to go quiet while the solicitors work through it. We're keeping an eye on both sides and chasing for updates where needed, and we'll come to you as soon as there's something worth sharing.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Initial enquiries raised: {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer's solicitor has raised their initial enquiries with the seller's solicitor.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM14 complete: Initial enquiries raised at {address}",
        heroLabel: "PM14: Initial enquiries raised",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised initial enquiries with vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM15: {
    label: "Initial replies received", chaseLabel: "Initial replies coming back from the seller's side", who: "solicitor",
    description: "The seller's solicitor has replied to your solicitor's questions. Your solicitor will review the answers and decide whether further questions are needed.",
    emailCopy: {
      vendor: {
        subject: "Your solicitor has replied to the buyer's enquiries: {address}",
        heroLabel: "Enquiry replies sent",
        opening: "Quick update on your sale.",
        whatHappened: "Your solicitor has replied to the buyer's solicitor's initial enquiries. The buyer's solicitor will now review the responses.",
        whatNext: "There may be follow-up questions. We'll keep you updated.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Seller's solicitor has replied to your solicitor's enquiries: {address}",
        heroLabel: "Enquiry replies received",
        opening: "Replies are in from the seller's side.",
        whatHappened: "The seller's solicitor has replied to your solicitor's initial enquiries. Your solicitor will now review the answers and assess whether everything has been addressed satisfactorily.",
        whatNext: "Your solicitor may come back with further questions, or they may be satisfied and begin working towards exchange. Either way, we'll keep you posted.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM15 complete: Initial replies received at {address}",
        heroLabel: "PM15: Initial replies received",
        opening: "Logged on {address}.",
        whatHappened: "Initial enquiry replies received from vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM16: {
    label: "Initial replies reviewed", chaseLabel: "Initial replies being reviewed", who: "solicitor",
    description: "Your solicitor has reviewed the replies to their enquiries. They may raise further questions, or they may be satisfied and move towards exchange.",
    emailCopy: {
      // PM16.vendor intentionally absent — PM16 is an internal buyer-side
      // review step; the seller has no actionable update on it. Per FINAL
      // the milestone is purchaser-only. Removing the legacy fallback
      // stops a noise email going to the seller every enquiry round.
      purchaser: {
        subject: "Your solicitor has reviewed the seller's replies: {address}",
        heroLabel: "Replies reviewed",
        opening: "Your solicitor has reviewed the seller's answers.",
        whatHappened: "Your solicitor has gone through the replies to their initial enquiries. They're assessing whether all the questions have been answered satisfactorily and whether any further questions are needed.",
        whatNext: "If further questions are needed, your solicitor will raise them. Otherwise, they'll move on to reviewing the remaining legal points before reporting to you and moving towards exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM16 complete: Initial replies reviewed at {address}",
        heroLabel: "PM16: Initial replies reviewed",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has reviewed initial enquiry replies.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM17: {
    label: "Additional enquiries raised", chaseLabel: "Additional enquiries going out to the seller's side", who: "solicitor",
    description: "Your solicitor has raised a second round of questions. This is completely normal. Most transactions go through two or three rounds of enquiries before all points are resolved.",
    emailCopy: {
      vendor: {
        subject: "Buyer's solicitor has raised further questions: {address}",
        heroLabel: "Further enquiries raised",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer's solicitor has raised a further round of enquiries with your solicitor. Multiple rounds of questions are completely normal in conveyancing. This doesn't indicate a problem.",
        whatNext: "Your solicitor will work through the additional questions and reply. We'll let you know when replies are sent.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Your solicitor has raised further questions: {address}",
        heroLabel: "Further enquiries raised",
        opening: "Another round of questions, completely normal.",
        whatHappened: "Your solicitor has raised a further round of enquiries with the seller's solicitor. Most transactions go through at least two rounds of questions before everything is resolved. This doesn't indicate a problem.",
        whatNext: "The seller's solicitor will work through the additional questions and reply. Your solicitor will then review and let you know if all points have been resolved.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM17 complete: Additional enquiries raised at {address}",
        heroLabel: "PM17: Additional enquiries raised",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM18: {
    label: "Additional replies received", chaseLabel: "Additional replies coming back from the seller's side", who: "solicitor",
    description: "Replies to the additional enquiries have arrived from the seller's solicitor. Your solicitor will review them.",
    emailCopy: {
      vendor: {
        subject: "Your solicitor has replied to further buyer enquiries: {address}",
        heroLabel: "Additional replies sent",
        opening: "Quick update on your sale.",
        whatHappened: "Your solicitor has replied to the buyer's solicitor's additional enquiries. The buyer's solicitor will now review the answers.",
        whatNext: "We'll let you know when the buyer's solicitor has worked through the replies.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Further replies received from the seller's solicitor: {address}",
        heroLabel: "Additional replies received",
        opening: "Replies to the further questions are in.",
        whatHappened: "The seller's solicitor has replied to your solicitor's additional enquiries. Your solicitor will now review the answers.",
        whatNext: "Your solicitor will assess whether all points have now been addressed. If they're satisfied, they'll move towards preparing their final report to you.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM18 complete: Additional replies received at {address}",
        heroLabel: "PM18: Additional replies received",
        opening: "Logged on {address}.",
        whatHappened: "Additional enquiry replies received from vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM19: {
    label: "Additional replies reviewed", chaseLabel: "Additional replies being reviewed", who: "solicitor",
    description: "Your solicitor has reviewed all outstanding replies. They should now have everything they need to report to you and move towards exchange.",
    emailCopy: {
      // PM19.vendor intentionally absent — PM19 is an internal buyer-side
      // review step; the seller has no actionable update on it. Per FINAL
      // the milestone is purchaser-only.
      purchaser: {
        subject: "Your solicitor has reviewed all replies: {address}",
        heroLabel: "All replies reviewed",
        opening: "Your solicitor has worked through everything.",
        whatHappened: "Your solicitor has reviewed all of the seller's replies and is working through the final legal points. They're assessing whether everything has been addressed to their satisfaction.",
        whatNext: "If your solicitor is satisfied, they'll send you their final report and confirm they're ready to exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM19 complete: Additional replies reviewed at {address}",
        heroLabel: "PM19: Additional replies reviewed",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has reviewed all outstanding enquiry replies.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM20: {
    label: "All enquiries satisfied", chaseLabel: "Final sign-off on all enquiries", who: "solicitor",
    description: "Your solicitor will confirm once all enquiries have been answered to their satisfaction. At this point, the legal investigation of the property will be largely complete, bringing you a significant step closer to exchange.",
    emailCopy: {
      vendor: {
        subject: "All legal enquiries resolved: {address}",
        heroLabel: "All enquiries satisfied",
        opening: "Good news on your sale.",
        whatHappened: "All of the buyer's solicitor's legal questions have been answered to their satisfaction. This is one of the final legal steps before exchange of contracts.",
        whatNext: "The buyer's solicitor will now prepare their final report to the buyer. Once the buyer reviews and signs off, you'll be ready to exchange.",
        action: "View your portal",
      },
      purchaser: {
        subject: "All legal questions resolved, moving towards exchange: {address}",
        heroLabel: "All enquiries satisfied",
        opening: "A significant milestone on your purchase.",
        whatHappened: "All of the legal questions about the property have been answered to your solicitor's satisfaction. This is one of the last major legal steps before exchange of contracts.",
        whatNext: "Your solicitor will now prepare their final report to you, which summarises the property, the title, the search results, and any conditions on your mortgage. Once you've received and reviewed that, you'll be ready to sign the contract and exchange.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "All enquiries satisfied: {address}",
        heroLabel: "Milestone complete",
        opening: "Good news on {address}.",
        whatHappened: "Buyer's solicitor has confirmed all enquiries satisfied. Transaction is in the final stretch before exchange.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM20 complete: All enquiries satisfied at {address}",
        heroLabel: "PM20: All enquiries satisfied",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed all enquiries satisfied.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  // Seller-side reflection of PM20 (buyer's "all enquiries satisfied"). It
  // auto-completes when PM20 is confirmed and carries NO client email blocks on
  // purpose: PM20's own vendor block already tells the seller enquiries are
  // satisfied, so a VM21 client email would be a duplicate. The label/description
  // exist so the step shows a proper name (never the raw code) on the portal and
  // in the timeline; only the internal progressor log fires.
  VM21: {
    label: "All enquiries satisfied", chaseLabel: "Confirm all enquiries are satisfied", who: "solicitor",
    description: "The buyer's solicitor will confirm once all of their enquiries have been answered to their satisfaction. This is a significant milestone and means the legal work is approaching the point where you can exchange contracts.",
    emailCopy: {
      progressor: {
        subject: "VM21 complete: All enquiries satisfied at {address}",
        heroLabel: "VM21: All enquiries satisfied",
        opening: "Logged on {address}.",
        whatHappened: "Seller-side reflection of all enquiries satisfied (mirrors the buyer's confirmation of PM20).",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM21: {
    label: "Final report received from solicitor", chaseLabel: "Confirm the final report from your solicitor has arrived", who: "you",
    description: "Your solicitor will send you their final report on the property, summarising the title, searches, enquiries and any relevant mortgage conditions. Read it carefully and raise any questions before proceeding.",
    next: "Your solicitor will send you the contract documents to review and sign.",
    emailCopy: {
      vendor: {
        subject: "Buyer is reviewing their solicitor's final report: {address}",
        heroLabel: "Final report stage",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer's solicitor has sent their final report to the buyer, a comprehensive summary of the property, title, searches, and mortgage conditions. The buyer is now reviewing it before signing the contract.",
        whatNext: "Once the buyer is satisfied and signs the contract, you'll be in the final stages before exchange.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Your solicitor's final report is ready: {address}",
        heroLabel: "Final report received",
        opening: "Your solicitor's final report has arrived.",
        whatHappened: "Your solicitor has sent you their final report, a comprehensive summary of everything about the property: the title, the search results, the replies to enquiries, and any conditions attached to your mortgage offer. This is the document you need to review before signing the contract.",
        whatNext: "Read the report carefully and raise any questions with your solicitor. Once you're happy, your solicitor will send you the contract to sign.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM21 complete: Buyer received final report at {address}",
        heroLabel: "PM21: Final report received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed receipt of solicitor's final report.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM22: {
    label: "Contract documents issued to you", labelOther: "Contract documents issued to buyer", chaseLabel: "Confirm the contract documents have arrived", who: "you",
    description: "Your solicitor will send you the contract documents to review and sign. Signing the contract does not make the purchase legally binding; that happens when contracts are exchanged.",
    next: "Sign and return the documents to your solicitor so they can hold them ready for exchange.",
    emailCopy: {
      vendor: {
        subject: "Buyer has been issued their contract: {address}",
        heroLabel: "Contract issued to buyer",
        opening: "Quick update on your sale.",
        whatHappened: "The buyer's solicitor has issued the contract documents to the buyer for review and signature. Things are moving into the final stretch before exchange.",
        whatNext: "Once the buyer signs and returns the contract, we're effectively ready to exchange.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Your contract is ready to sign: {address}",
        heroLabel: "Contract ready to sign",
        opening: "Your contract documents have arrived.",
        whatHappened: "Your solicitor has sent you the contract documents to review and sign. You're now moving towards exchange of contracts.",
        whatNext: "Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Your solicitor will explain exactly what signing means and what you're committing to. Exchange is the legally binding moment. Once you're happy, sign and return it.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM22 complete: Contract issued to buyer at {address}",
        heroLabel: "PM22: Contract issued to buyer",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has issued contract documents to purchaser for signature.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM23: {
    label: "Sign and return contract documents", labelOther: "Buyer signed and returned contract", who: "you",
    description: "Sign and return the contract documents to your solicitor. They'll hold them ready for exchange once all remaining requirements have been met.",
    next: "You'll need to make sure your solicitor has the required deposit funds ready for exchange.",
    emailCopy: {
      vendor: {
        subject: "Buyer has signed and returned their contract: {address}",
        heroLabel: "Contract signed",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has signed their contract documents and returned them to their solicitor. Both sides are now very close to being ready to exchange.",
        whatNext: "Once the deposit is in place and both solicitors confirm readiness, exchange can happen. We'll keep you updated.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Signed contract received, ready for exchange: {address}",
        heroLabel: "Contract signed and returned",
        opening: "Your signed contract is with your solicitor.",
        whatHappened: "Your solicitor has received your signed contract documents and is holding them ready for exchange. They will have explained what signing means. The legally binding moment is exchange, not this step.",
        whatNext: "Make sure your deposit is on its way to your solicitor's client account if it isn't already. It needs to be there as cleared funds before exchange can happen.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer has signed and returned their contract: {address}",
        heroLabel: "Milestone complete",
        opening: "Good news on {address}.",
        whatHappened: "Buyer has signed and returned contract to their solicitor. Both sides are close to exchange readiness.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM23 complete: Buyer signed and returned contract at {address}",
        heroLabel: "PM23: Buyer signed contract",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed signed contract returned to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM24: {
    label: "Transfer the deposit", labelOther: "Buyer transferred the deposit", who: "you",
    description: "Transfer the required deposit to your solicitor's client account so the funds are cleared and ready for exchange. Your solicitor will confirm the amount you need to send.",
    next: "Once everyone in the chain is ready, we'll work with the other side to agree the completion date and coordinate exchange.",
    emailCopy: {
      vendor: {
        subject: "Buyer's deposit is in place: {address}",
        heroLabel: "Deposit received",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has transferred their deposit to their solicitor's client account as cleared funds. This is one of the final requirements before exchange can take place.",
        whatNext: "Everything on the buyer's side is in place. Exchange is very close.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Deposit received, ready for exchange: {address}",
        heroLabel: "Deposit received",
        opening: "Your deposit is in place.",
        whatHappened: "Your solicitor has confirmed receipt of your deposit as cleared funds. This is one of the final requirements before exchange of contracts can take place.",
        whatNext: "Everything is now in place on your side. We're coordinating exchange with the seller's solicitor. You could be exchanging very soon.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM24 complete: Buyer transferred deposit at {address}",
        heroLabel: "PM24: Buyer transferred deposit",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed deposit transferred to solicitor's client account.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM25: {
    label: "Solicitor confirms ready to exchange", who: "solicitor", typicalDuration: "typically 1–5 days after signing",
    description: "Your solicitor will confirm once everything is in place for you to exchange contracts. We'll then coordinate with the seller's side and the rest of the chain to get everyone ready to exchange.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor is ready to exchange: {address}",
        heroLabel: "Ready to exchange",
        opening: "Your solicitor has confirmed they're ready.",
        whatHappened: "Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the seller's side confirms the same.",
        whatNext: "We're now coordinating with the seller's solicitor to confirm exchange. Make sure you're reachable. Exchange can sometimes happen very quickly once both sides are ready.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer's solicitor is ready to exchange: {address}",
        heroLabel: "Buyer ready to exchange",
        opening: "The buyer's side is ready.",
        whatHappened: "The buyer's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.",
        whatNext: "We'll be coordinating exchange with both solicitors. Make sure you're reachable.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM25 complete: Buyer solicitor ready to exchange at {address}",
        heroLabel: "PM25: Buyer solicitor ready to exchange",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed readiness to exchange.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM26: {
    label: "Contracts exchanged", who: "agent",
    description: "Your solicitor will exchange contracts with the seller's solicitor, making your purchase legally binding and fixing the completion date. After exchange, neither you nor the seller can withdraw without potentially significant financial consequences.",
    emailCopy: {
      purchaser: {
        subject: "Contracts exchanged, your purchase is legally committed: {address}",
        heroLabel: "Contracts exchanged",
        opening: "Contracts have exchanged on your purchase.",
        whatHappened: "Both solicitors have formally exchanged signed contracts, your deposit has been transferred, and your purchase is now legally binding. The completion date is fixed.",
        whatNext: "Now is the time to confirm your removal firm and start planning your move in detail. Buildings insurance: risk in the property usually passes to you on exchange. Check with your solicitor whether this applies to your purchase, as for new-builds and many leaseholds the freeholder's policy covers the building. Your solicitor will manage the final transfer of funds on completion day.",
        action: "View your portal",
      },
      // PM26.vendor intentionally absent — the seller is notified via VM19
      // (auto-completed as PM26's bilateral counterpart). The FINAL PM26
      // skeleton is purchaser-only by design.
      progressor: {
        subject: "PM26 complete: Contracts exchanged at {address}",
        heroLabel: "PM26: Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts exchanged. Both parties legally committed. Completion date fixed. Reconcile any outstanding milestones and confirm the completion date is recorded.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM27: {
    label: "Purchase completed", who: "agent",
    description: "On completion day, your solicitor will transfer the remaining purchase funds to the seller's solicitor. Once received, the purchase is complete and you can collect the keys. Your solicitor will then register your ownership with HM Land Registry.",
    emailCopy: {
      purchaser: {
        subject: "Purchase complete, welcome to your new home: {address}",
        heroLabel: "Purchase complete",
        opening: "Congratulations. It's done.",
        whatHappened: "Your purchase has completed. The funds have been transferred, ownership has passed to you, and the keys are yours. Your solicitor will now arrange for your ownership to be registered at HM Land Registry.",
        whatNext: "Keep your completion statement and transfer documents safely for your records. You may need them for future legal or tax purposes. Your solicitor will send confirmation of Land Registry registration once it's been processed, which can take several months.",
        action: "View your portal",
      },
      // PM27.vendor intentionally absent — the seller is notified via VM20
      // (auto-completed as PM27's bilateral counterpart). The FINAL PM27
      // skeleton is purchaser-only by design.
      progressor: {
        subject: "PM27 complete: Purchase completed at {address}",
        heroLabel: "PM27: Purchase completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Purchase completed. Transaction closed. Reconcile any outstanding milestones and confirm all fees are recorded.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },
};

// Double-confirmation subtext shown under "Are you sure?" in the confirm sheet.
// A plain-English statement of exactly what the client is attesting to when they
// mark a step done, so a confirm is a considered action, not a reflex tap. Keyed
// by milestone code. Founder-authored 2026-08-16.
const CONFIRM_COPY: Record<string, string> = {
  // ── Buyer (purchaser) ──
  PM1: "You have formally instructed your solicitor and confirmed that you would like them to act for you on this purchase.",
  PM2: "You have received the memorandum of sale confirming the details of your purchase and the solicitors acting for both sides.",
  PM3: "You have completed the identity, anti-money laundering and source of funds checks requested by your solicitor.",
  PM4: "You have paid the money on account requested by your solicitor to cover searches and other initial costs.",
  PM5: "Your full mortgage application has been submitted to your lender, either by you or your mortgage broker.",
  PM6: "Your mortgage broker, lender or we have confirmed that the lender's valuation of the property has been booked.",
  PM11: "Your mortgage broker or lender has formally confirmed your mortgage offer, and a copy has been sent to your solicitor.",
  PM9: "Your survey has been booked with a surveyor and you have a confirmed appointment for the property.",
  PM10: "You have received the completed survey report from your surveyor.",
  PM7: "Your solicitor has confirmed that they have received the draft contract pack from the seller's solicitor.",
  PM8: "Your solicitor has confirmed that all required property searches have been ordered.",
  PM12: "Your solicitor has confirmed that they have received the management pack for the property.",
  PM13: "Your solicitor has confirmed that all property search results have been received.",
  PM14: "Your solicitor has confirmed that their initial enquiries have been sent to the seller's solicitor.",
  PM20: "Your solicitor has confirmed that all enquiries have been answered to their satisfaction.",
  PM21: "You have received your solicitor's final report on the property and are ready to proceed with the remaining steps towards exchange.",
  PM22: "Your solicitor has sent you the contract, TR1 transfer deed and, if applicable, mortgage deed to review and sign.",
  PM23: "You have signed and returned the contract, TR1 transfer deed and, if applicable, mortgage deed requested by your solicitor.",
  PM24: "You have transferred the deposit required for exchange to your solicitor's client account.",
  PM25: "Your solicitor has confirmed that everything is in place for you to exchange contracts.",
  PM26: "Your solicitor has confirmed that contracts have been exchanged and your purchase is now legally binding.",
  PM27: "Your solicitor has confirmed completion and the property is now legally yours.",
  // ── Seller (vendor) ──
  VM1: "You have formally instructed your solicitor and confirmed that you would like them to act for you on this sale.",
  VM2: "You have received the memorandum of sale confirming the details of your sale and the solicitors acting for both sides.",
  VM3: "You have received your solicitor's welcome pack with the documents and information they need from you.",
  VM4: "You have completed the identity, anti-money laundering and source of funds checks requested by your solicitor.",
  VM5: "You have received the TA6 Property Information Form and TA10 Fittings and Contents Form from your solicitor to complete.",
  VM6: "You have completed and returned the TA6 Property Information Form and TA10 Fittings and Contents Form to your solicitor.",
  VM7: "Your solicitor has confirmed that the draft contract pack has been sent to the buyer's solicitor.",
  VM8: "Your solicitor has confirmed that the management pack has been requested from the freeholder, managing agent or management company.",
  VM9: "Your solicitor has confirmed that they have received the management pack for the property.",
  VM10: "Your solicitor has confirmed that the buyer's solicitor has raised their initial enquiries.",
  VM21: "The buyer's solicitor has confirmed that all enquiries have been answered to their satisfaction.",
  VM16: "Your solicitor has sent you the contract and TR1 transfer deed to review and sign.",
  VM17: "You have signed and returned the contract and TR1 transfer deed requested by your solicitor.",
  VM18: "Your solicitor has confirmed that everything is in place for you to exchange contracts.",
  VM19: "Your solicitor has confirmed that contracts have been exchanged and your sale is now legally binding.",
  VM20: "Your solicitor has confirmed completion and the sale of your property is complete.",
};

export function getMilestoneConfirmCopy(code: string): string | null {
  return CONFIRM_COPY[code] ?? null;
}

export function getMilestoneCopy(code: string): PortalCopy {
  return copy[code] ?? { label: code, who: "solicitor" };
}

export function getEventDateLabel(code: string): string {
  if (code === "PM6") return "Valuation date";
  if (code === "PM9") return "Survey date";
  if (code === "VM19" || code === "PM26") return "Exchanged on";
  if (code === "VM20" || code === "PM27") return "Completion date";
  return "Event date";
}

export const WHO_LABELS: Record<string, string> = {
  you:       "You",
  solicitor: "Your solicitor",
  agent:     "Us",
  lender:    "Your lender",
};
