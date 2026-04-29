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
  progressor?: RecipientEmailCopy;
};

export type PortalCopy = {
  label: string;
  labelOther?: string;  // third-person version shown when the other party views this milestone
  who: "you" | "solicitor" | "agent" | "lender";
  typicalDuration?: string;
  description?: string;
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
  // ── Vendor milestones ────────────────────────────────────────────────────
  VM1: {
    label: "Instruct your solicitor", labelOther: "Seller instructed their solicitor", who: "you",
    description: "You need to formally appoint a solicitor to handle the legal side of your sale. Contact them directly to confirm you're instructing them — they'll then begin preparing the paperwork.",
    emailCopy: {
      vendor: {
        subject: "You've instructed your solicitor — {address}",
        heroLabel: "Solicitor instructed",
        opening: "You've taken the first step.",
        whatHappened: "You've formally instructed your solicitor to act on the sale. They'll now start the conveyancing process on your behalf — preparing the contract pack, gathering title documents, and raising any questions from the buyer's side.",
        whatNext: "Your solicitor will prepare the contract pack and, if the property is leasehold, request the management pack from your freeholder or managing agent. This typically takes a few weeks. We'll be in touch when there's a meaningful update.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has instructed their solicitor — {address}",
        heroLabel: "Seller's solicitor instructed",
        opening: "Good news on your purchase.",
        whatHappened: "The seller has formally instructed their solicitor to act on the sale. This is an important early step — things are now moving on the seller's side of the transaction.",
        whatNext: "Nothing for you to do right now. The seller's solicitor will prepare the contract pack and send it to your solicitor in the coming weeks. We'll let you know when that happens.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Seller's solicitor instructed — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "The seller has instructed their solicitor. Conveyancing is now underway on the seller's side.",
        whatNext: "No action needed from you. The progression team will chase the contract pack when appropriate.",
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM1 complete: Seller instructed solicitor — {address}",
        heroLabel: "VM1 — Seller instructed solicitor",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed solicitor instruction.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM2: {
    label: "Receive memorandum of sale", who: "solicitor",
    description: "Your estate agent sends a memorandum of sale to all solicitors confirming the agreed price, buyer details, and any special conditions. This officially kicks off the legal process.",
    emailCopy: {
      vendor: {
        subject: "Memorandum of sale issued — {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed price and the details of both parties. This is the document that formally kicks off conveyancing.",
        whatNext: "Your solicitor will now begin preparing the contract pack. If you haven't already, make sure you've returned your solicitor's welcome pack — delays here can slow everything down.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Memorandum of sale issued — {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to proceed.",
        whatNext: "Make sure you've returned your solicitor's welcome pack and completed your ID checks if you haven't already — these need to be done before your solicitor can get fully underway.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "MoS confirmed — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Memorandum of sale confirmed issued to all solicitors.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM2 complete: MoS received — {address}",
        heroLabel: "VM2 — MoS received",
        opening: "Logged on {address}.",
        whatHappened: "Memorandum of sale confirmed received by vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM3: {
    label: "Receive welcome pack from solicitor", labelOther: "Seller received welcome pack from solicitor", who: "you",
    description: "Your solicitor sends you a welcome pack containing their terms of business, a questionnaire, and ID requirements. Return it promptly — delays here slow down the whole transaction.",
    emailCopy: {
      vendor: {
        subject: "Welcome pack received from your solicitor — {address}",
        heroLabel: "Welcome pack received",
        opening: "Your solicitor has made contact.",
        whatHappened: "Your solicitor has sent you their welcome pack. It contains their terms of business, a property questionnaire, and details of what ID they need from you. Returning this quickly is one of the best things you can do to keep the transaction moving.",
        whatNext: "Complete the forms and return them as soon as you can — ideally within a few days. Your solicitor cannot begin substantive work until these are back with them.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM3 complete: Seller received welcome pack — {address}",
        heroLabel: "VM3 — Seller received welcome pack",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed receipt of solicitor's welcome pack.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM14: {
    label: "Complete ID & AML checks", labelOther: "Seller completed ID & AML checks", who: "you",
    description: "Anti-money laundering law requires your solicitor to verify your identity. You'll need a passport or driving licence, plus a recent utility bill or bank statement. This is a legal requirement.",
    emailCopy: {
      vendor: {
        subject: "ID checks complete — {address}",
        heroLabel: "ID & AML checks done",
        opening: "You've cleared an important legal requirement.",
        whatHappened: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This clears the way for them to begin substantive work on your behalf.",
        whatNext: "Your solicitor will now continue preparing the contract pack. We'll be in touch when the next milestone is reached.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM14 complete: Seller ID checks done — {address}",
        heroLabel: "VM14 — Seller ID & AML complete",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed completion of ID and AML verification.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM15: {
    label: "Receive property information forms", labelOther: "Seller received property information forms", who: "you",
    description: "Your solicitor will send you property information forms (TA6 and TA10) asking about the property — fixtures included in the sale, disputes, planning consents, and more. Complete these carefully and honestly.",
    emailCopy: {
      vendor: {
        subject: "Property information forms received — {address}",
        heroLabel: "Property forms to complete",
        opening: "Your solicitor needs information from you.",
        whatHappened: "Your solicitor has sent you the property information forms (TA6 and TA10). These ask about the property's history, what's included in the sale, any disputes or planning permissions, and more. The buyer's solicitor will rely on your answers.",
        whatNext: "Complete the forms as thoroughly and accurately as you can — these are legal documents. Return them to your solicitor promptly. If you're unsure about any question, call your solicitor before leaving it blank.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM15 complete: Seller received property forms — {address}",
        heroLabel: "VM15 — Seller received property forms",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed receipt of TA6/TA10 property information forms.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM4: {
    label: "Return completed property forms", labelOther: "Seller returned completed property forms", who: "you",
    description: "Once you've filled in the property information forms, return them to your solicitor. These are sent to the buyer's solicitor as part of the contract pack.",
    emailCopy: {
      vendor: {
        subject: "Property forms returned to your solicitor — {address}",
        heroLabel: "Property forms returned",
        opening: "Good work — your forms are back with your solicitor.",
        whatHappened: "Your completed property information forms have been received by your solicitor. They'll now incorporate these into the contract pack and send everything to the buyer's solicitor.",
        whatNext: "Your solicitor will issue the draft contract pack to the buyer's solicitor. We'll let you know when that's done.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has returned their property information forms — {address}",
        heroLabel: "Property forms returned",
        opening: "Progress on your purchase.",
        whatHappened: "The seller has returned their completed property information forms to their solicitor. These will be included in the contract pack that comes to your solicitor.",
        whatNext: "Nothing to do from your side right now. The seller's solicitor will now finalise the contract pack and send it across.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Seller's property forms returned — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Seller has returned completed property information forms. Contract pack preparation can now be finalised.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM4 complete: Seller returned property forms — {address}",
        heroLabel: "VM4 — Seller returned property forms",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed return of completed TA6/TA10 forms to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM5: {
    label: "Draft contract pack issued", who: "solicitor",
    description: "Your solicitor sends the draft contract pack to the buyer's solicitor. This includes the contract, property information forms, title documents, and any relevant certificates.",
    emailCopy: {
      vendor: {
        subject: "Draft contract pack sent to the buyer's solicitor — {address}",
        heroLabel: "Contract pack issued",
        opening: "A significant step forward.",
        whatHappened: "Your solicitor has sent the draft contract pack to the buyer's solicitor. This is the bundle of documents that forms the legal foundation of the sale — the contract itself, your property information forms, title documents, and any relevant certificates.",
        whatNext: "The buyer's solicitor will now review everything carefully and is likely to raise enquiries — questions about the property and the documents. Your solicitor will handle these, though they may need your input on some points.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The contract pack has arrived with your solicitor — {address}",
        heroLabel: "Contract pack received",
        opening: "Things are moving on your purchase.",
        whatHappened: "The seller's solicitor has sent the contract pack to your solicitor. This is the full bundle of legal documents — the draft contract, title documents, property information forms, and more. Your solicitor will now review everything in detail.",
        whatNext: "Your solicitor will go through the contract pack and raise any questions that need answering. In the meantime, make sure your mortgage application is progressing and any searches have been ordered.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Contract pack issued — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Seller's solicitor has issued the draft contract pack to the buyer's solicitor.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM5 complete: Contract pack issued — {address}",
        heroLabel: "VM5 — Draft contract pack issued",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has issued draft contract pack to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM6: {
    label: "Management pack requested", who: "solicitor",
    description: "If the property is leasehold or share of freehold, your solicitor requests a management pack from the freeholder or managing agent. This contains details about service charges, ground rent, and building insurance.",
    emailCopy: {
      vendor: {
        subject: "Management pack requested from your freeholder — {address}",
        heroLabel: "Management pack requested",
        opening: "Leasehold paperwork is underway.",
        whatHappened: "Your solicitor has requested the management pack from your freeholder or managing agent. This pack contains the leasehold information the buyer's solicitor will need — service charge accounts, ground rent history, building insurance, and details of any planned major works.",
        whatNext: "Management packs can take a while — typically several weeks, sometimes longer. There's nothing you need to do right now, but be aware this is often one of the slower parts of a leasehold transaction. We'll let you know as soon as it arrives.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM6 complete: Management pack requested — {address}",
        heroLabel: "VM6 — Management pack requested",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has requested management pack from freeholder/managing agent.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM7: {
    label: "Management pack received", who: "solicitor", typicalDuration: "can take 4–8 weeks",
    description: "The management pack has arrived from the freeholder or managing agent. These often take weeks to arrive and are one of the most common causes of delays in leasehold transactions.",
    emailCopy: {
      vendor: {
        subject: "Management pack received — {address}",
        heroLabel: "Management pack received",
        opening: "The leasehold paperwork has arrived.",
        whatHappened: "The management pack has been received from your freeholder or managing agent. Your solicitor will now review the leasehold information — service charges, ground rent, building insurance, and any planned works — before sending it to the buyer's solicitor.",
        whatNext: "This is often one of the longer waits in a leasehold transaction, so receiving it is real progress. Your solicitor will incorporate the pack into the contract pack and send it across to the buyer's side.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Management pack received on your purchase — {address}",
        heroLabel: "Management pack received",
        opening: "Good news on the leasehold side.",
        whatHappened: "The management pack from the freeholder has arrived and is being reviewed. This contains the leasehold information your solicitor needs — service charges, ground rent, building insurance, and details of any planned major works to the building.",
        whatNext: "Your solicitor will review the management pack carefully and raise any points with the seller's solicitor as part of the enquiries process.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Management pack received — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Management pack received from freeholder. Solicitor is reviewing.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM7 complete: Management pack received — {address}",
        heroLabel: "VM7 — Management pack received",
        opening: "Logged on {address}.",
        whatHappened: "Management pack confirmed received by vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM16: {
    label: "Initial enquiries received", who: "solicitor",
    description: "The buyer's solicitor has raised questions about the property — these might cover planning history, building works, boundaries, or anything in the documents that needs clarification.",
    emailCopy: {
      vendor: {
        subject: "Buyer's enquiries received — {address}",
        heroLabel: "Enquiries received",
        opening: "The buyer's solicitor has questions.",
        whatHappened: "The buyer's solicitor has raised their first round of enquiries — questions about the property and the documents in the contract pack. This is a completely normal part of the process. Your solicitor will work through them and may need your input on some points.",
        whatNext: "If your solicitor contacts you asking for information to help answer the enquiries, please respond as quickly as you can. Delays in enquiries are one of the most common reasons transactions slow down.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM16 complete: Initial enquiries received — {address}",
        heroLabel: "VM16 — Initial enquiries received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised initial enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM17: {
    label: "Provide replies to enquiries", labelOther: "Seller provided replies to enquiries", who: "you",
    description: "Your solicitor needs your input to answer some of the buyer's questions. Respond as quickly as you can — delays in enquiries are one of the most common reasons transactions stall.",
    emailCopy: {
      vendor: {
        subject: "Action needed: your solicitor needs your help — {address}",
        heroLabel: "Your input needed",
        opening: "Your solicitor needs answers from you.",
        whatHappened: "Some of the buyer's enquiries require information that only you can provide. Your solicitor has been in touch to ask for your help in preparing the replies.",
        whatNext: "Please respond to your solicitor as quickly as you can — ideally within 24–48 hours. Delays at this stage are one of the most common reasons transactions stall. The faster you reply, the sooner the enquiries can be resolved.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM17 complete: Seller provided enquiry replies — {address}",
        heroLabel: "VM17 — Seller provided replies",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed they've provided replies to solicitor for initial enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM8: {
    label: "Replies sent to buyer's solicitor", who: "solicitor",
    description: "Your solicitor has sent replies to the buyer's enquiries. The buyer's solicitor will review these and may raise further questions.",
    emailCopy: {
      vendor: {
        subject: "Enquiry replies sent to the buyer's solicitor — {address}",
        heroLabel: "Replies sent",
        opening: "Your solicitor has replied to the enquiries.",
        whatHappened: "Your solicitor has sent their replies to the buyer's solicitor's initial enquiries. The buyer's solicitor will now review these and may come back with further questions — this is completely normal.",
        whatNext: "There's nothing for you to do right now. If another round of questions arrives, we'll let you know.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has replied to your solicitor's enquiries — {address}",
        heroLabel: "Enquiry replies received",
        opening: "Progress on the enquiries.",
        whatHappened: "The seller's solicitor has sent replies to your solicitor's initial enquiries. Your solicitor will now review the answers and decide whether any further questions are needed.",
        whatNext: "Your solicitor will let you know if anything in the replies needs your attention. Otherwise, they'll continue working through the remaining points before you move towards exchange.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Enquiry replies sent — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Vendor's solicitor has replied to buyer's initial enquiries.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM8 complete: Replies sent to buyer's solicitor — {address}",
        heroLabel: "VM8 — Initial replies sent",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has sent initial enquiry replies to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM18: {
    label: "Additional enquiries received", who: "solicitor",
    description: "A second round of questions has arrived from the buyer's solicitor. This is completely normal — most transactions have at least two rounds of enquiries.",
    emailCopy: {
      vendor: {
        subject: "Additional enquiries from the buyer — {address}",
        heroLabel: "Further enquiries received",
        opening: "Another round of questions — this is completely normal.",
        whatHappened: "The buyer's solicitor has raised a second round of enquiries following your solicitor's replies. This is a routine part of the process — most transactions go through at least two rounds before all questions are resolved.",
        whatNext: "Your solicitor will work through these. If they need your input on any points, they'll be in touch — please respond as promptly as you can.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM18 complete: Additional enquiries received — {address}",
        heroLabel: "VM18 — Additional enquiries received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM19: {
    label: "Provide additional replies", labelOther: "Seller provided additional replies", who: "you",
    description: "Your solicitor needs your help with another set of questions from the buyer. Answer them as soon as possible to keep the transaction moving.",
    emailCopy: {
      vendor: {
        subject: "Action needed: further replies required from you — {address}",
        heroLabel: "Your input needed",
        opening: "Your solicitor needs your help again.",
        whatHappened: "The buyer has raised another round of questions, and some of them require your input to answer. Your solicitor has been in touch to ask for your help.",
        whatNext: "Please come back to your solicitor as quickly as you can. Every day of delay at this stage extends the time to exchange. Most transactions have two rounds of enquiries — you're nearly through it.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM19 complete: Seller provided additional replies — {address}",
        heroLabel: "VM19 — Seller provided additional replies",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed they've provided replies to solicitor for additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM9: {
    label: "Additional replies sent", who: "solicitor",
    description: "Your solicitor has replied to the additional enquiries. Once both solicitors are satisfied, you're moving towards exchange.",
    emailCopy: {
      vendor: {
        subject: "All enquiry replies sent — moving towards exchange — {address}",
        heroLabel: "All replies sent",
        opening: "The enquiries are behind you.",
        whatHappened: "Your solicitor has sent replies to all outstanding enquiries from the buyer's solicitor. Both sides are now working towards exchange of contracts.",
        whatNext: "The next steps are your solicitor sending you the contract to sign and confirming they're ready to exchange. We'll be in touch when there's an update.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller has replied to all enquiries — {address}",
        heroLabel: "All replies received",
        opening: "The enquiry stage is winding up.",
        whatHappened: "The seller's solicitor has replied to all of your solicitor's enquiries. Your solicitor will now review the additional replies and work through any remaining outstanding points.",
        whatNext: "Once your solicitor is satisfied with all the replies, they'll prepare their final report to you and confirm they're ready to move towards exchange.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "All enquiry replies sent — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Vendor's solicitor has sent replies to all buyer enquiries. Moving towards exchange.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM9 complete: Additional replies sent — {address}",
        heroLabel: "VM9 — Additional replies sent",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has sent additional enquiry replies to buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM10: {
    label: "Contract documents issued to you", labelOther: "Contract documents issued to seller", who: "you",
    description: "Your solicitor has sent you the final contract to review and sign. Read it carefully — check the price, completion date, and what's included in the sale.",
    emailCopy: {
      vendor: {
        subject: "Your contract is ready to sign — {address}",
        heroLabel: "Contract ready to sign",
        opening: "You're nearly at the finish line.",
        whatHappened: "Your solicitor has sent you the contract documents to review and sign. This is an important step — you're now moving towards exchange of contracts.",
        whatNext: "Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Once you're happy, sign and return it to your solicitor. Signing doesn't commit you yet — exchange is the legally binding moment.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM10 complete: Contract issued to seller — {address}",
        heroLabel: "VM10 — Contract issued to seller",
        opening: "Logged on {address}.",
        whatHappened: "Vendor solicitor has issued contract documents to the vendor for signature.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM11: {
    label: "Sign and return contract documents", labelOther: "Seller signed and returned contract", who: "you",
    description: "Sign the contract documents and return them to your solicitor. The contracts aren't exchanged yet — you're signing them ready for exchange, which is the legally binding moment.",
    emailCopy: {
      vendor: {
        subject: "Signed contract received — ready for exchange — {address}",
        heroLabel: "Contract signed and returned",
        opening: "Your signed contract is with your solicitor.",
        whatHappened: "Your solicitor has received your signed contract documents and is holding them ready for exchange. The legal commitment doesn't happen until exchange itself — but you're now in the final stretch.",
        whatNext: "Your solicitor will confirm when they're ready to exchange. Once both sides are ready, your agent will coordinate the exchange and a completion date will be agreed.",
        action: "View your portal",
      },
      progressor: {
        subject: "VM11 complete: Seller signed and returned contract — {address}",
        heroLabel: "VM11 — Seller signed contract",
        opening: "Logged on {address}.",
        whatHappened: "Vendor has confirmed signed contract returned to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM20: {
    label: "Solicitor confirms ready to exchange", who: "solicitor", typicalDuration: "typically 1–5 days after signing",
    description: "Your solicitor has confirmed they have everything in place to exchange contracts. Once both sides are ready, your agent will coordinate the exchange.",
    emailCopy: {
      vendor: {
        subject: "Your solicitor is ready to exchange — {address}",
        heroLabel: "Ready to exchange",
        opening: "Your solicitor has confirmed they're ready.",
        whatHappened: "Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the buyer's side is ready too.",
        whatNext: "We're now coordinating with the buyer's solicitor to confirm exchange. Once both sides are ready, exchange will be arranged — this can happen very quickly. Make sure you're reachable.",
        action: "View your portal",
      },
      purchaser: {
        subject: "The seller's solicitor is ready to exchange — {address}",
        heroLabel: "Seller ready to exchange",
        opening: "The seller's side is ready.",
        whatHappened: "The seller's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.",
        whatNext: "Make sure your deposit is in your solicitor's client account as cleared funds, and that your signed contract has been returned. We'll be in touch as soon as exchange is confirmed.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Seller's solicitor ready to exchange — {address}",
        heroLabel: "Ready to exchange",
        opening: "Quick update on {address}.",
        whatHappened: "Vendor's solicitor has confirmed readiness to exchange. Awaiting buyer's side.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM20 complete: Vendor solicitor ready to exchange — {address}",
        heroLabel: "VM20 — Vendor solicitor ready to exchange",
        opening: "Logged on {address}.",
        whatHappened: "Vendor's solicitor has confirmed readiness to exchange.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM12: {
    label: "Contracts exchanged", who: "agent",
    description: "Exchange is the legally binding moment of your sale. Both solicitors formally exchange signed contracts. Neither side can now withdraw without significant financial penalty. The completion date is now fixed.",
    emailCopy: {
      vendor: {
        subject: "Contracts exchanged — your sale is legally committed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "This is the moment that makes it real.",
        whatHappened: "Contracts have exchanged. Both solicitors have formally exchanged signed contracts, and the sale is now legally binding. Neither side can withdraw without significant financial penalty. The completion date is now fixed.",
        whatNext: "Between now and completion, you should arrange to have everything ready to leave the property by the agreed time on completion day. Your solicitor will manage the legal transfer of funds — you'll hear from them on the day.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Contracts exchanged — your purchase is legally committed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "This is the moment that makes it real.",
        whatHappened: "Contracts have exchanged. Both solicitors have formally exchanged signed contracts, and your purchase is now legally binding. The completion date is now fixed — your new home is essentially yours.",
        whatNext: "Now is the time to confirm your removal firm, arrange buildings insurance from today (the legal risk of the property has passed to you), and start planning your move. Your solicitor will manage the final transfer of funds on completion day.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Exchange confirmed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts have exchanged. Both parties are now legally committed. Completion date is fixed.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM12 complete: Contracts exchanged — {address}",
        heroLabel: "VM12 — Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts exchanged. Both parties legally committed. Completion date fixed.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  VM13: {
    label: "Sale completed", who: "agent",
    description: "The sale is complete. Your solicitor has received the purchase funds, redeemed your mortgage, and transferred ownership. Leave the keys and any agreed items at the property.",
    emailCopy: {
      vendor: {
        subject: "Sale complete — congratulations — {address}",
        heroLabel: "Sale complete",
        opening: "Congratulations — it's done.",
        whatHappened: "Your sale has completed. The purchase funds have been transferred, your mortgage has been redeemed by your solicitor, and ownership of the property has transferred to the buyer. The sale is legally concluded.",
        whatNext: "Your solicitor will send you a completion statement showing the final figures. If you're also buying, the net proceeds will be passed to your purchase solicitor. Keep your completion statement safely — you may need it for tax purposes.",
        action: "View your portal",
      },
      purchaser: {
        subject: "Sale completed — {address}",
        heroLabel: "Sale completed",
        opening: "Completion confirmed on your purchase property.",
        whatHappened: "The sale of {address} has completed. The property now belongs to your seller and the transaction is legally concluded.",
        whatNext: null,
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Completion confirmed — {address}",
        heroLabel: "Sale completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Sale completed. Funds transferred, mortgage redeemed, ownership transferred.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "VM13 complete: Sale completed — {address}",
        heroLabel: "VM13 — Sale completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Sale completed. Transaction closed.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  // ── Purchaser milestones ─────────────────────────────────────────────────
  PM1: {
    label: "Instruct your solicitor", labelOther: "Buyer instructed their solicitor", who: "you",
    description: "Formally appoint a solicitor to handle the conveyancing for your purchase. Contact them to confirm you're instructing them — they'll send you a welcome pack and start work.",
    emailCopy: {
      purchaser: {
        subject: "You've instructed your solicitor — {address}",
        heroLabel: "Solicitor instructed",
        opening: "You've taken the first step.",
        whatHappened: "You've formally instructed your solicitor to act on your purchase. They'll now contact you with a welcome pack, their terms of business, and details of what they need from you to get started.",
        whatNext: "Return your solicitor's welcome pack and complete your ID checks as quickly as possible — your solicitor cannot begin substantive work until these are in place. We'll update you when there's meaningful progress.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer has instructed their solicitor — {address}",
        heroLabel: "Buyer's solicitor instructed",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has formally instructed their solicitor to act on the purchase. The legal process is now underway on both sides of the transaction.",
        whatNext: "Nothing for you to do right now. Both solicitors are now engaged and will work through the conveyancing process. We'll keep you updated.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer's solicitor instructed — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "The buyer has instructed their solicitor. Conveyancing is now underway on the buyer's side.",
        whatNext: "No action needed from you.",
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM1 complete: Buyer instructed solicitor — {address}",
        heroLabel: "PM1 — Buyer instructed solicitor",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed solicitor instruction.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM2: {
    label: "Receive memorandum of sale", who: "solicitor",
    description: "The estate agent sends a memorandum of sale to all solicitors confirming the agreed price and parties. This officially starts the legal process on both sides.",
    emailCopy: {
      purchaser: {
        subject: "Memorandum of sale issued — {address}",
        heroLabel: "Legal process underway",
        opening: "The legal process has officially started.",
        whatHappened: "The memorandum of sale has been sent to all solicitors, confirming the agreed purchase price and the details of both parties. Your solicitor now has formal confirmation to begin conveyancing.",
        whatNext: "If you haven't already, return your solicitor's welcome pack and complete your ID checks — your solicitor can't get fully started until these are done. Also make sure your mortgage application is progressing if you're buying with a mortgage.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM2 complete: MoS received — {address}",
        heroLabel: "PM2 — MoS received",
        opening: "Logged on {address}.",
        whatHappened: "Memorandum of sale confirmed received by buyer's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM14a: {
    label: "Complete ID & AML checks", labelOther: "Buyer completed ID & AML checks", who: "you",
    description: "Anti-money laundering regulations require your solicitor to verify your identity before they can act for you. You'll need a photo ID and a recent proof of address.",
    emailCopy: {
      purchaser: {
        subject: "ID checks complete — {address}",
        heroLabel: "ID & AML checks done",
        opening: "You've cleared an important legal requirement.",
        whatHappened: "Your identity has been verified and your solicitor has completed the anti-money laundering checks required by law. This allows them to begin substantive work on your purchase.",
        whatNext: "Your solicitor is now able to work on your case fully. We'll be in touch when the next milestone is reached.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM14a complete: Buyer ID checks done — {address}",
        heroLabel: "PM14a — Buyer ID & AML complete",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed completion of ID and AML verification.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM15a: {
    label: "Pay money on account to solicitor", labelOther: "Buyer paid money on account to solicitor", who: "you",
    description: "Your solicitor will ask for an initial payment to cover the cost of searches and disbursements. This is separate from the deposit and is typically a few hundred pounds.",
    emailCopy: {
      purchaser: {
        subject: "Payment on account received by your solicitor — {address}",
        heroLabel: "Payment on account received",
        opening: "Your solicitor has received your payment on account.",
        whatHappened: "Your initial payment to your solicitor has been received. This covers the cost of searches and other disbursements they'll incur on your behalf during the conveyancing process. This is separate from your deposit.",
        whatNext: "Your solicitor can now order searches and proceed with the full conveyancing process. We'll update you as each stage progresses.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM15a complete: Buyer paid money on account — {address}",
        heroLabel: "PM15a — Buyer paid money on account",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed payment on account to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM4: {
    label: "Submit mortgage application", labelOther: "Buyer submitted mortgage application", who: "you",
    description: "If you're buying with a mortgage, submit your full mortgage application to your lender. Your broker can do this on your behalf. Your agreement in principle needs to be converted into a full application.",
    emailCopy: {
      purchaser: {
        subject: "Mortgage application submitted — {address}",
        heroLabel: "Mortgage application submitted",
        opening: "Your mortgage application is in.",
        whatHappened: "Your full mortgage application has been submitted to your lender. They'll now assess your application, arrange a valuation of the property, and work towards issuing a formal mortgage offer.",
        whatNext: "Your lender will book a valuation of the property — usually within a week or two. Once the valuation is done, the formal mortgage offer typically follows within 1–3 weeks. Your broker will keep you updated.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM4 complete: Buyer submitted mortgage application — {address}",
        heroLabel: "PM4 — Buyer submitted mortgage application",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed mortgage application submitted.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM5: {
    label: "Lender valuation booked", who: "lender", typicalDuration: "usually 1–2 weeks after application",
    description: "Your mortgage lender has booked a valuation of the property to confirm it's worth what you're paying. This is not a structural survey — it's for the lender's benefit, not yours. Consider booking your own survey separately.",
    emailCopy: {
      purchaser: {
        subject: "Mortgage valuation booked — {address}",
        heroLabel: "Lender valuation booked",
        opening: "Your mortgage lender has booked their valuation.",
        whatHappened: "Your lender has arranged a valuation of the property to confirm it's worth what you're paying. This is purely for the lender's benefit — it's not a structural survey and won't flag problems with the condition of the property.",
        whatNext: "If you haven't already booked your own survey, now is a good time. A RICS HomeBuyer Report (Level 2) typically costs £400–700 and can identify issues that the lender's valuation won't cover. Once the valuation is done, your mortgage offer should follow within 1–3 weeks.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM5 complete: Lender valuation booked — {address}",
        heroLabel: "PM5 — Lender valuation booked",
        opening: "Logged on {address}.",
        whatHappened: "Lender valuation confirmed booked.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM3: {
    label: "Draft contract pack received", who: "solicitor",
    description: "Your solicitor has received the contract pack from the seller's solicitor. This includes the draft contract, title documents, and property information forms. Your solicitor will review everything carefully.",
    emailCopy: {
      purchaser: {
        subject: "Contract pack received by your solicitor — {address}",
        heroLabel: "Contract pack received",
        opening: "The legal documents are with your solicitor.",
        whatHappened: "Your solicitor has received the contract pack from the seller's solicitor. This is the bundle of documents that forms the legal foundation of the purchase — the draft contract, title documents, property information forms, and any relevant certificates. Your solicitor will now review everything carefully.",
        whatNext: "Your solicitor will work through the contract pack and raise enquiries — questions about anything that needs clarification. In parallel, make sure your mortgage application and surveys are progressing.",
        action: "View your portal",
      },
      vendor: {
        subject: "Your contract pack has arrived with the buyer's solicitor — {address}",
        heroLabel: "Contract pack received",
        opening: "Progress on your sale.",
        whatHappened: "The contract pack has been received by the buyer's solicitor. They'll now review everything carefully and will raise any questions they have about the property or the documents.",
        whatNext: "The buyer's solicitor will raise enquiries in due course. Your solicitor will handle these, though they may need your input on some points — we'll be in touch if so.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Contract pack received by buyer's solicitor — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer's solicitor has confirmed receipt of the contract pack.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM3 complete: Contract pack received — {address}",
        heroLabel: "PM3 — Draft contract pack received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed receipt of draft contract pack.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM9: {
    label: "Searches ordered", who: "solicitor", typicalDuration: "results in 2–6 weeks",
    description: "Your solicitor has applied for searches — checks with the local council, water authority, and other bodies. These reveal planning permissions, flood risk, drainage, and other factors affecting the property.",
    emailCopy: {
      purchaser: {
        subject: "Searches ordered on your purchase — {address}",
        heroLabel: "Searches ordered",
        opening: "Your solicitor has ordered the searches.",
        whatHappened: "Your solicitor has submitted the search applications to the local authority, water authority, and other relevant bodies. Searches check for things like planning permissions, flood risk, drainage rights, and other factors that could affect the property.",
        whatNext: "Searches typically take 2–6 weeks to come back depending on the local authority — there's nothing for you to do while you wait. We'll let you know when they arrive.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM9 complete: Searches ordered — {address}",
        heroLabel: "PM9 — Searches ordered",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed searches ordered.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM7: {
    label: "Book your survey", labelOther: "Buyer booked their survey", who: "you",
    description: "Consider booking an independent structural survey. A RICS HomeBuyer Report (Level 2) costs around £400–700 and covers the condition of the property in detail — something the lender's valuation does not do. It's there for your peace of mind and protection.",
    emailCopy: {
      purchaser: {
        subject: "Survey booked — {address}",
        heroLabel: "Survey booked",
        opening: "Good call — your survey is booked.",
        whatHappened: "Your independent survey has been booked. The surveyor will inspect the property and produce a report covering its condition, any issues they find, and recommendations.",
        whatNext: "Most survey reports flag some issues — many are minor. When the report arrives, read it carefully and discuss any concerns with your solicitor. If anything significant is flagged, it may be worth seeking a specialist report or renegotiating the price.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM7 complete: Buyer booked survey — {address}",
        heroLabel: "PM7 — Buyer booked survey",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed survey booked.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM20: {
    label: "Survey report received", who: "you",
    description: "Your surveyor has delivered their report. Read it carefully. Most reports flag some issues — many are minor. If anything significant is raised, speak to your solicitor who can advise on the appropriate next steps.",
    emailCopy: {
      purchaser: {
        subject: "Your survey report has arrived — {address}",
        heroLabel: "Survey report received",
        opening: "Your survey report is ready.",
        whatHappened: "Your surveyor has delivered their report on the property. Most surveys flag some issues — it's rare to get a completely clean report, so don't be alarmed if yours highlights a few things.",
        whatNext: "Read the report carefully and note anything rated as a significant risk or requiring urgent attention. If you have concerns, speak to your solicitor — they can advise on whether to seek a specialist report or request further information from the seller.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM20 complete: Buyer received survey report — {address}",
        heroLabel: "PM20 — Survey report received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed receipt of survey report.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM6: {
    label: "Mortgage offer received", who: "lender", typicalDuration: "typically 1–3 weeks after valuation",
    description: "Your mortgage lender has formally offered you the loan. Check the amount, interest rate, term, and any conditions. Your solicitor will receive a copy — they'll need to check it against the property title.",
    emailCopy: {
      purchaser: {
        subject: "Your mortgage offer has arrived — {address}",
        heroLabel: "Mortgage offer received",
        opening: "Your mortgage is confirmed.",
        whatHappened: "Your lender has issued a formal mortgage offer. This confirms the amount they're willing to lend, the interest rate, the term, and any conditions attached. Your solicitor has received a copy and will check it against the property title.",
        whatNext: "Check the offer carefully — confirm the loan amount, rate, and term match what you agreed with your broker. If anything looks wrong, speak to your broker immediately. Your solicitor will review the conditions and let you know if anything needs addressing.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer's mortgage offer has been issued — {address}",
        heroLabel: "Buyer's mortgage offer received",
        opening: "Good news on your sale.",
        whatHappened: "The buyer has received their formal mortgage offer from their lender. The financing for your sale is now confirmed — a significant step towards exchange.",
        whatNext: "Nothing for you to do. The transaction is moving in the right direction on the buyer's side.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer's mortgage offer issued — {address}",
        heroLabel: "Milestone complete",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer has received their formal mortgage offer. Financing confirmed.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM6 complete: Buyer mortgage offer received — {address}",
        heroLabel: "PM6 — Mortgage offer received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed mortgage offer received from lender.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM8: {
    label: "Management pack received", who: "solicitor",
    description: "If the property is leasehold, the management pack from the freeholder or managing agent has arrived. Your solicitor will review service charge accounts, ground rent, building insurance, and any planned major works.",
    emailCopy: {
      purchaser: {
        subject: "Management pack received — {address}",
        heroLabel: "Management pack received",
        opening: "The leasehold paperwork has arrived.",
        whatHappened: "The management pack from the freeholder has been received by your solicitor. They'll now review the service charge accounts, ground rent history, building insurance arrangements, and any planned or recent major works to the building.",
        whatNext: "Your solicitor will raise any concerns from the management pack with the seller's solicitor as part of the enquiries process. We'll let you know if anything needs your attention.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM8 complete: Management pack received — {address}",
        heroLabel: "PM8 — Management pack received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed management pack received.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM10: {
    label: "Search results received", who: "solicitor", typicalDuration: "usually 2–6 weeks",
    description: "The search results have come back from the local authority and other bodies. Your solicitor will review them and flag anything that needs attention or further investigation.",
    emailCopy: {
      purchaser: {
        subject: "Search results back — {address}",
        heroLabel: "Search results received",
        opening: "Your searches have come back.",
        whatHappened: "The search results have been received from the local authority and other bodies. Your solicitor will now review them carefully — they cover planning permissions, flood risk, drainage, and other factors affecting the property.",
        whatNext: "Most searches come back with nothing of concern. If your solicitor does identify something worth discussing, they'll be in touch. Otherwise, this keeps things moving towards exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM10 complete: Search results received — {address}",
        heroLabel: "PM10 — Search results received",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed search results received.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM11: {
    label: "Initial enquiries raised", who: "solicitor",
    description: "Your solicitor has sent questions to the seller's solicitor about the property. This is a normal part of the process — they're checking everything is in order before you exchange.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor has raised enquiries — {address}",
        heroLabel: "Enquiries raised",
        opening: "Your solicitor is asking the right questions.",
        whatHappened: "Your solicitor has raised their first round of enquiries with the seller's solicitor — questions about the property, the title, and the documents in the contract pack. This is a completely normal and important part of the conveyancing process.",
        whatNext: "The seller's solicitor will work through the questions and reply in due course. Your solicitor will review the replies and let you know if any further questions are needed.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM11 complete: Initial enquiries raised — {address}",
        heroLabel: "PM11 — Initial enquiries raised",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised initial enquiries with vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM21: {
    label: "Initial replies received", who: "solicitor",
    description: "The seller's solicitor has replied to your solicitor's questions. Your solicitor will review the answers and decide whether further questions are needed.",
    emailCopy: {
      purchaser: {
        subject: "Seller's solicitor has replied to your solicitor's enquiries — {address}",
        heroLabel: "Enquiry replies received",
        opening: "Replies are in from the seller's side.",
        whatHappened: "The seller's solicitor has replied to your solicitor's initial enquiries. Your solicitor will now review the answers and assess whether everything has been addressed satisfactorily.",
        whatNext: "Your solicitor may come back with further questions, or they may be satisfied and begin working towards exchange. Either way, we'll keep you updated.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM21 complete: Initial replies received — {address}",
        heroLabel: "PM21 — Initial replies received",
        opening: "Logged on {address}.",
        whatHappened: "Initial enquiry replies received from vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM22: {
    label: "Initial replies reviewed", who: "solicitor",
    description: "Your solicitor has reviewed the replies to their enquiries. They may raise further questions, or they may be satisfied and move towards exchange.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor has reviewed the seller's replies — {address}",
        heroLabel: "Replies reviewed",
        opening: "Your solicitor has reviewed the seller's answers.",
        whatHappened: "Your solicitor has gone through the replies to their initial enquiries. They're assessing whether all the questions have been answered satisfactorily and whether any further questions are needed.",
        whatNext: "If further questions are needed, your solicitor will raise them. Otherwise, they'll move on to reviewing the remaining legal points before reporting to you and moving towards exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM22 complete: Initial replies reviewed — {address}",
        heroLabel: "PM22 — Initial replies reviewed",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has reviewed initial enquiry replies.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM12: {
    label: "Additional enquiries raised", who: "solicitor",
    description: "Your solicitor has raised a second round of questions. This is completely normal — most transactions go through two or three rounds of enquiries before all points are resolved.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor has raised further questions — {address}",
        heroLabel: "Further enquiries raised",
        opening: "Another round of questions — completely normal.",
        whatHappened: "Your solicitor has raised a further round of enquiries with the seller's solicitor. Most transactions go through at least two rounds of questions before everything is resolved — this doesn't indicate a problem.",
        whatNext: "The seller's solicitor will work through the additional questions and reply. Your solicitor will then review and let you know if all points have been resolved.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM12 complete: Additional enquiries raised — {address}",
        heroLabel: "PM12 — Additional enquiries raised",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has raised additional enquiries.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM23: {
    label: "Additional replies received", who: "solicitor",
    description: "Replies to the additional enquiries have arrived from the seller's solicitor. Your solicitor will review them.",
    emailCopy: {
      purchaser: {
        subject: "Further replies received from the seller's solicitor — {address}",
        heroLabel: "Additional replies received",
        opening: "Replies to the further questions are in.",
        whatHappened: "The seller's solicitor has replied to your solicitor's additional enquiries. Your solicitor will now review the answers.",
        whatNext: "Your solicitor will assess whether all points have now been addressed. If they're satisfied, they'll move towards preparing their final report to you.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM23 complete: Additional replies received — {address}",
        heroLabel: "PM23 — Additional replies received",
        opening: "Logged on {address}.",
        whatHappened: "Additional enquiry replies received from vendor's solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM24: {
    label: "Additional replies reviewed", who: "solicitor",
    description: "Your solicitor has reviewed all outstanding replies. They should now have everything they need to report to you and move towards exchange.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor has reviewed all replies — {address}",
        heroLabel: "All replies reviewed",
        opening: "Your solicitor has worked through everything.",
        whatHappened: "Your solicitor has reviewed all of the seller's replies and is working through the final legal points. They're assessing whether everything has been addressed to their satisfaction.",
        whatNext: "If your solicitor is satisfied, they'll send you their final report and confirm they're ready to exchange. You're in the home straight.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM24 complete: Additional replies reviewed — {address}",
        heroLabel: "PM24 — Additional replies reviewed",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has reviewed all outstanding enquiry replies.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM25: {
    label: "All enquiries satisfied", who: "solicitor",
    description: "All legal questions about the property have been answered to your solicitor's satisfaction. This is a significant milestone — you're now in the final stretch before exchange.",
    emailCopy: {
      purchaser: {
        subject: "All legal questions resolved — moving towards exchange — {address}",
        heroLabel: "All enquiries satisfied",
        opening: "A significant milestone on your purchase.",
        whatHappened: "All of the legal questions about the property have been answered to your solicitor's satisfaction. This is one of the last major legal hurdles before exchange of contracts.",
        whatNext: "Your solicitor will now prepare their final report to you, which summarises the property, the title, the search results, and any conditions on your mortgage. Once you've received and reviewed that, you'll be ready to sign the contract and exchange.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM25 complete: All enquiries satisfied — {address}",
        heroLabel: "PM25 — All enquiries satisfied",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed all enquiries satisfied.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM26: {
    label: "Final report received from solicitor", who: "you",
    description: "Your solicitor has sent you their final report summarising everything about the property, the title, the searches, and any conditions on your mortgage offer. Read it and raise any questions before signing.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor's final report is ready — {address}",
        heroLabel: "Final report received",
        opening: "Your solicitor's final report has arrived.",
        whatHappened: "Your solicitor has sent you their final report — a comprehensive summary of everything about the property: the title, the search results, the replies to enquiries, and any conditions attached to your mortgage offer. This is the document you need to review before signing the contract.",
        whatNext: "Read the report carefully and raise any questions with your solicitor before signing. Once you're happy, your solicitor will send you the contract to sign. You're very close to exchange now.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM26 complete: Buyer received final report — {address}",
        heroLabel: "PM26 — Final report received",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed receipt of solicitor's final report.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM13: {
    label: "Contract documents issued to you", labelOther: "Contract documents issued to buyer", who: "you",
    description: "Your solicitor has sent you the contract to review and sign. Check the price, completion date, and included fixtures. Signing doesn't commit you yet — that happens at exchange.",
    emailCopy: {
      purchaser: {
        subject: "Your contract is ready to sign — {address}",
        heroLabel: "Contract ready to sign",
        opening: "You're nearly at the finish line.",
        whatHappened: "Your solicitor has sent you the contract documents to review and sign. You're now very close to exchange of contracts.",
        whatNext: "Read the contract carefully. Check the purchase price, the proposed completion date, and the list of fixtures and fittings included in the sale. Once you're happy, sign and return it to your solicitor. Signing at this stage doesn't commit you — exchange is the legally binding moment.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM13 complete: Contract issued to buyer — {address}",
        heroLabel: "PM13 — Contract issued to buyer",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has issued contract documents to purchaser for signature.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM14b: {
    label: "Sign and return contract documents", labelOther: "Buyer signed and returned contract", who: "you",
    description: "Sign the contract and return it to your solicitor. They'll hold it ready for exchange. Make sure you're happy with the completion date before signing.",
    emailCopy: {
      purchaser: {
        subject: "Signed contract received — ready for exchange — {address}",
        heroLabel: "Contract signed and returned",
        opening: "Your signed contract is with your solicitor.",
        whatHappened: "Your solicitor has received your signed contract documents and is holding them ready for exchange. You're not yet legally committed — that happens when contracts formally exchange.",
        whatNext: "Make sure your deposit is on its way to your solicitor's client account if it isn't already — it needs to be there as cleared funds before exchange can happen.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM14b complete: Buyer signed and returned contract — {address}",
        heroLabel: "PM14b — Buyer signed contract",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed signed contract returned to solicitor.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM15b: {
    label: "Transfer the deposit", labelOther: "Buyer transferred the deposit", who: "you",
    description: "Transfer your deposit — typically 10% of the purchase price — to your solicitor's client account. It must be cleared funds before exchange can happen. Allow a few days for bank transfers.",
    emailCopy: {
      purchaser: {
        subject: "Deposit received — ready for exchange — {address}",
        heroLabel: "Deposit received",
        opening: "Your deposit is in place.",
        whatHappened: "Your solicitor has confirmed receipt of your deposit as cleared funds. This is one of the final requirements before exchange of contracts can take place.",
        whatNext: "Everything is now in place on your side. We're coordinating exchange with the seller's solicitor — you could be exchanging very soon.",
        action: "View your portal",
      },
      progressor: {
        subject: "PM15b complete: Buyer transferred deposit — {address}",
        heroLabel: "PM15b — Buyer transferred deposit",
        opening: "Logged on {address}.",
        whatHappened: "Purchaser has confirmed deposit transferred to solicitor's client account.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM27: {
    label: "Solicitor confirms ready to exchange", who: "solicitor", typicalDuration: "typically 1–5 days after signing",
    description: "Your solicitor has confirmed they have everything they need to exchange. Your agent is now coordinating with the seller's side to agree a date and time.",
    emailCopy: {
      purchaser: {
        subject: "Your solicitor is ready to exchange — {address}",
        heroLabel: "Ready to exchange",
        opening: "Your solicitor has confirmed they're ready.",
        whatHappened: "Your solicitor has everything in place to exchange contracts. They've confirmed to us that they're ready to proceed as soon as the seller's side confirms the same.",
        whatNext: "We're now coordinating with the seller's solicitor to confirm exchange. Make sure you're reachable — exchange can sometimes happen very quickly once both sides are ready.",
        action: "View your portal",
      },
      vendor: {
        subject: "The buyer's solicitor is ready to exchange — {address}",
        heroLabel: "Buyer ready to exchange",
        opening: "The buyer's side is ready.",
        whatHappened: "The buyer's solicitor has confirmed they're ready to exchange contracts. If your solicitor is also ready, exchange can be coordinated imminently.",
        whatNext: "We'll be coordinating exchange with both solicitors. Make sure you're reachable.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Buyer's solicitor ready to exchange — {address}",
        heroLabel: "Ready to exchange",
        opening: "Quick update on {address}.",
        whatHappened: "Buyer's solicitor has confirmed readiness to exchange. Coordinating with vendor's side.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM27 complete: Buyer solicitor ready to exchange — {address}",
        heroLabel: "PM27 — Buyer solicitor ready to exchange",
        opening: "Logged on {address}.",
        whatHappened: "Buyer's solicitor has confirmed readiness to exchange.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM16: {
    label: "Contracts exchanged", who: "agent",
    description: "Exchange is the legally binding moment of your purchase. Both solicitors exchange signed contracts and your deposit is transferred. The completion date is now fixed and neither side can withdraw without financial penalty.",
    emailCopy: {
      purchaser: {
        subject: "Contracts exchanged — your purchase is legally committed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "This is the moment that makes it real.",
        whatHappened: "Contracts have exchanged. Both solicitors have formally exchanged signed contracts, your deposit has been transferred, and your purchase is now legally binding. The completion date is fixed — your new home is secured.",
        whatNext: "Now is the time to confirm your removal firm, arrange buildings insurance from today (the legal risk of the property has passed to you as buyer), and start planning your move in detail. Your solicitor will manage the final transfer of funds on completion day.",
        action: "View your portal",
      },
      vendor: {
        subject: "Contracts exchanged — your sale is legally committed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "This is the moment that makes it real.",
        whatHappened: "Contracts have exchanged. Both solicitors have formally exchanged signed contracts, and your sale is now legally binding. The completion date is fixed — neither side can withdraw without significant financial penalty.",
        whatNext: "Between now and completion, arrange to have everything ready to leave the property by the agreed time on completion day. Your solicitor will manage the legal transfer of funds.",
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Exchange confirmed — {address}",
        heroLabel: "Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts have exchanged. Both parties are now legally committed. Completion date is fixed.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM16 complete: Contracts exchanged — {address}",
        heroLabel: "PM16 — Contracts exchanged",
        opening: "Exchange confirmed on {address}.",
        whatHappened: "Contracts exchanged. Both parties legally committed. Completion date fixed.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },

  PM17: {
    label: "Purchase completed", who: "agent",
    description: "The purchase is complete. Your solicitor has received the title deeds and will register your ownership at HM Land Registry. The keys are yours — welcome home.",
    emailCopy: {
      purchaser: {
        subject: "Purchase complete — welcome to your new home — {address}",
        heroLabel: "Purchase complete",
        opening: "Congratulations — it's done.",
        whatHappened: "Your purchase has completed. The funds have been transferred, ownership has passed to you, and the keys are yours. Your solicitor will now arrange for your ownership to be registered at HM Land Registry.",
        whatNext: "Keep your completion statement and transfer documents safely — you may need them for future legal or tax purposes. Your solicitor will send confirmation of Land Registry registration once it's been processed, which can take several months.",
        action: "View your portal",
      },
      vendor: {
        subject: "Completion confirmed on your sale — {address}",
        heroLabel: "Sale completed",
        opening: "Completion confirmed.",
        whatHappened: "The purchase of {address} has completed. The property has transferred to the buyer and the transaction is legally concluded.",
        whatNext: null,
        action: "View your portal",
      },
      vendorAgent: {
        subject: "Completion confirmed — {address}",
        heroLabel: "Purchase completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Purchase completed. Funds transferred, ownership registered. Transaction closed.",
        whatNext: null,
        action: "View in dashboard",
      },
      progressor: {
        subject: "PM17 complete: Purchase completed — {address}",
        heroLabel: "PM17 — Purchase completed",
        opening: "Completion confirmed on {address}.",
        whatHappened: "Purchase completed. Transaction closed.",
        whatNext: null,
        action: "View transaction",
      },
    },
  },
};

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
  agent:     "Your agent",
  lender:    "Your lender",
};
