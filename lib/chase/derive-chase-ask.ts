// Deterministic chase-ask derivation. Given the selected milestone and the
// chosen recipient, the APP decides exactly what we are asking for. The AI never
// chooses or substitutes the step — it only writes up `recipientAction`.
//
// Design + the full recipient x action-holder matrix:
// docs/active/chase-action-derivation/00-design.md.
//
// Client-safe (no server imports).

import { getActionHolder, partySide, type Party } from "./action-holders";

export type ChaseShape = "ASK_DIRECT" | "VIA_OWN_SOLICITOR" | "VIA_BROKER" | "NOT_CHASED";

export interface ChaseAsk {
  // False for excluded milestones (notifications, enquiries tracker) or unknown
  // codes — the caller should not offer AI generation.
  chaseable: boolean;
  milestoneBeingChased: string;
  actionHolderRole: Party | null;
  recipientRole: Party;
  recipientIsActionHolder: boolean;
  shape: ChaseShape;
  // The authoritative instruction injected into the prompt. Controls WHAT is
  // asked and of WHOM; the AI controls the wording only.
  recipientAction: string;
  // Set when the recipient/milestone combination is out of scope (shouldn't be
  // offered by the side-scoped recipient list). Caller should log it.
  unexpected?: boolean;
}

function isSolicitor(p: Party): boolean {
  return p === "seller_solicitor" || p === "buyer_solicitor";
}

// Third-person label for the AI's instruction (never shown to the recipient).
export function partyLabel(p: Party): string {
  switch (p) {
    case "seller":
      return "the seller";
    case "buyer":
      return "the buyer";
    case "seller_solicitor":
      return "the seller's solicitor";
    case "buyer_solicitor":
      return "the buyer's solicitor";
    case "broker":
      return "the mortgage broker";
    case "agent":
      return "our team";
  }
}

export function deriveChaseAsk(input: {
  milestoneCode: string;
  milestoneName: string;
  recipientRole: Party;
}): ChaseAsk {
  const { milestoneCode, milestoneName, recipientRole } = input;
  const spec = getActionHolder(milestoneCode);
  const milestone = milestoneName;

  if (!spec || spec.kind === "excluded" || !spec.holder) {
    return {
      chaseable: false,
      milestoneBeingChased: milestone,
      actionHolderRole: null,
      recipientRole,
      recipientIsActionHolder: false,
      shape: "NOT_CHASED",
      recipientAction: "",
    };
  }

  const holder = spec.holder;
  const recipientIsActionHolder = recipientRole === holder;
  const recipientSide = partySide(recipientRole);
  const isReceipt = spec.kind === "receipt";
  const isClientRecipient = recipientRole === "seller" || recipientRole === "buyer";

  let shape: ChaseShape;
  let recipientAction: string;
  let unexpected = false;

  if (spec.kind === "client_broker" && (recipientRole === "buyer" || recipientRole === "broker")) {
    // Mortgage steps run through the buyer via their broker/lender.
    shape = "VIA_BROKER";
    recipientAction =
      `Ask ${recipientRole === "broker" ? "them" : "them (or their mortgage broker)"} to progress or confirm "${milestone}". ` +
      `This usually runs through the buyer's mortgage broker, so offer to liaise with the broker directly if that helps. ` +
      `Do not ask about any other step.`;
  } else if (recipientIsActionHolder) {
    // The recipient is the party who does / confirms it.
    shape = "ASK_DIRECT";
    if (isReceipt) {
      recipientAction =
        `Ask them to confirm whether "${milestone}" has arrived. ` +
        `If it has not, ask them to chase ${partyLabel(spec.upstream!)} for it. ` +
        `Do not move the ask onto any other step.`;
    } else {
      recipientAction =
        `Ask them directly to complete, or update us on, "${milestone}". ` +
        `This is their own responsibility. Do not ask about any other step.`;
    }
  } else if (isClientRecipient && isSolicitor(holder) && recipientSide && partySide(holder) === recipientSide) {
    // Client whose OWN-side solicitor owns the action.
    shape = "VIA_OWN_SOLICITOR";
    recipientAction =
      `You are writing to a client, but this step is their solicitor's job, not theirs. ` +
      `Ask whether their solicitor has confirmed "${milestone}" is ${isReceipt ? "arrived" : "done"}. ` +
      `If not, suggest they give their own solicitor a nudge, and offer that we are happy to chase the solicitor for them.`;
    if (isReceipt && spec.upstream) {
      recipientAction +=
        ` If their solicitor has not received it, add that it is worth their solicitor contacting ${partyLabel(spec.upstream)} about it.`;
    }
    recipientAction +=
      ` Never ask the client to carry out the legal step themselves, and never switch to a different step.`;
  } else if (isSolicitor(recipientRole)) {
    // A solicitor who is not the holder: usually the sender on a receipt step.
    shape = "ASK_DIRECT";
    if (isReceipt && spec.upstream === recipientRole) {
      recipientAction =
        `Ask them to issue or send "${milestone}" over to ${partyLabel(holder)}, or confirm they already have. ` +
        `Do not ask about any other step.`;
    } else {
      recipientAction =
        `Ask them directly about "${milestone}" and what is needed to move it forward. ` +
        `Do not ask about any other step.`;
    }
  } else {
    // Out-of-scope combination (side-scoped recipient list should prevent this).
    // Produce a safe check-in rather than inventing a task; caller logs it.
    unexpected = true;
    shape = "VIA_OWN_SOLICITOR";
    recipientAction =
      `Ask whether they have had any update on "${milestone}", and offer to help chase it. ` +
      `Do not ask them to carry out the step themselves, and do not switch to a different step.`;
  }

  return {
    chaseable: true,
    milestoneBeingChased: milestone,
    actionHolderRole: holder,
    recipientRole,
    recipientIsActionHolder,
    shape,
    recipientAction,
    ...(unexpected ? { unexpected } : {}),
  };
}
