// Who physically owns each milestone — the deterministic source of truth for
// chase-message generation. The AI never decides what we're chasing; the app
// derives it from this map (see lib/chase/derive-chase-ask.ts) and hands the AI
// a fixed instruction.
//
// Hand-authored and reviewed row by row from the "Who is responsible" +
// "What outstanding means" rows of docs/chase-generation/MILESTONE_GLOSSARY.md.
// Design + rationale: docs/active/chase-action-derivation/00-design.md.
//
// Client-safe (no server imports) so both the generate-chase route and, later,
// the chase drawer can read it. Mirrors the lib/milestone-prerequisites.ts pattern.
//
// Two facts this map exists to encode, because neither can be inferred from the
// VM/PM prefix:
//   1. Action-holder side != milestone side (e.g. VM10 is owned by the BUYER's
//      solicitor even though it's a vendor-side code).
//   2. "Receipt" milestones split the confirmer (who confirms arrival) from the
//      sender (the escalation if it hasn't arrived). We are confirmer-led: the
//      confirmer is the holder; the sender is `upstream`.

export type Party =
  | "seller"
  | "buyer"
  | "seller_solicitor"
  | "buyer_solicitor"
  | "broker"
  | "agent";

export type Side = "vendor" | "purchaser";

// client       — a client (buyer/seller) does it themselves
// own_sol      — the milestone-side solicitor does it
// receipt      — the holder confirms arrival; `upstream` sent it (confirmer-led)
// client_broker— a mortgage step driven by the buyer via their broker/lender
// excluded     — not AI-chased (notifications + the enquiries-tracker milestone)
export type MilestoneKind = "client" | "own_sol" | "receipt" | "client_broker" | "excluded";

export interface ActionHolderSpec {
  kind: MilestoneKind;
  // Who does or (for receipt) confirms this milestone. Omitted for `excluded`.
  holder?: Party;
  // Receipt only: who sends the thing — chased as the escalation if it hasn't
  // arrived. Often the OTHER side's solicitor, or the agent (for the MOS).
  upstream?: Party;
  // The mirror milestone on the other side, for the "worth your solicitor
  // contacting the other side" escalation line.
  crossRef?: string;
}

// The side a party sits on. `agent` has no side (that's us).
export function partySide(p: Party): Side | null {
  switch (p) {
    case "seller":
    case "seller_solicitor":
      return "vendor";
    case "buyer":
    case "buyer_solicitor":
    case "broker":
      return "purchaser";
    case "agent":
      return null;
  }
}

export const ACTION_HOLDERS: Record<string, ActionHolderSpec> = {
  // ── Vendor (seller) side ────────────────────────────────────────────────
  VM1: { kind: "client", holder: "seller" },
  VM2: { kind: "receipt", holder: "seller", upstream: "agent" },
  VM3: { kind: "receipt", holder: "seller", upstream: "seller_solicitor" },
  VM4: { kind: "client", holder: "seller" },
  VM5: { kind: "own_sol", holder: "seller_solicitor" },
  VM6: { kind: "client", holder: "seller" },
  VM7: { kind: "own_sol", holder: "seller_solicitor", crossRef: "PM7" },
  VM8: { kind: "own_sol", holder: "seller_solicitor" },
  VM9: { kind: "own_sol", holder: "seller_solicitor", crossRef: "PM12" },
  VM10: { kind: "receipt", holder: "seller_solicitor", upstream: "buyer_solicitor", crossRef: "PM14" },
  VM11: { kind: "client", holder: "seller" },
  VM12: { kind: "own_sol", holder: "seller_solicitor", crossRef: "PM15" },
  VM13: { kind: "receipt", holder: "seller_solicitor", upstream: "buyer_solicitor", crossRef: "PM17" },
  VM14: { kind: "client", holder: "seller" },
  VM15: { kind: "own_sol", holder: "seller_solicitor", crossRef: "PM18" },
  VM16: { kind: "own_sol", holder: "seller_solicitor" },
  VM17: { kind: "client", holder: "seller" },
  VM18: { kind: "own_sol", holder: "seller_solicitor" },
  VM19: { kind: "excluded" }, // exchange notification — exchange has its own chasing
  VM20: { kind: "excluded" }, // completion notification — a phone call, not an email
  VM21: { kind: "excluded" }, // enquiries tracker owns this; future enquiries page

  // ── Purchaser (buyer) side ──────────────────────────────────────────────
  PM1: { kind: "client", holder: "buyer" },
  PM2: { kind: "receipt", holder: "buyer", upstream: "agent" },
  PM3: { kind: "client", holder: "buyer" },
  PM4: { kind: "client", holder: "buyer" },
  PM5: { kind: "client_broker", holder: "buyer" },
  PM6: { kind: "client_broker", holder: "buyer" },
  PM7: { kind: "receipt", holder: "buyer_solicitor", upstream: "seller_solicitor", crossRef: "VM7" },
  PM8: { kind: "own_sol", holder: "buyer_solicitor" },
  PM9: { kind: "client", holder: "buyer" },
  PM10: { kind: "client", holder: "buyer" },
  PM11: { kind: "client_broker", holder: "buyer" },
  PM12: { kind: "receipt", holder: "buyer_solicitor", upstream: "seller_solicitor", crossRef: "VM9" },
  PM13: { kind: "own_sol", holder: "buyer_solicitor" },
  PM14: { kind: "own_sol", holder: "buyer_solicitor", crossRef: "VM10" },
  PM15: { kind: "receipt", holder: "buyer_solicitor", upstream: "seller_solicitor", crossRef: "VM12" },
  PM16: { kind: "own_sol", holder: "buyer_solicitor" },
  PM17: { kind: "own_sol", holder: "buyer_solicitor", crossRef: "VM13" },
  PM18: { kind: "receipt", holder: "buyer_solicitor", upstream: "seller_solicitor", crossRef: "VM15" },
  PM19: { kind: "own_sol", holder: "buyer_solicitor" },
  PM20: { kind: "own_sol", holder: "buyer_solicitor" },
  PM21: { kind: "receipt", holder: "buyer", upstream: "buyer_solicitor" },
  PM22: { kind: "own_sol", holder: "buyer_solicitor" },
  PM23: { kind: "client", holder: "buyer" },
  PM24: { kind: "client", holder: "buyer" },
  PM25: { kind: "own_sol", holder: "buyer_solicitor" },
  PM26: { kind: "excluded" }, // exchange notification
  PM27: { kind: "excluded" }, // completion notification
};

export function getActionHolder(code: string): ActionHolderSpec | null {
  return ACTION_HOLDERS[code] ?? null;
}

export function isChaseable(code: string): boolean {
  const spec = ACTION_HOLDERS[code];
  return !!spec && spec.kind !== "excluded";
}
