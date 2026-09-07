/**
 * @jest-environment node
 */

// Exhaustive coverage for the deterministic chase-ask derivation.
// Design: docs/active/chase-action-derivation/00-design.md.
//
// Two layers:
//   1. Invariants across EVERY milestone x EVERY recipient relationship.
//   2. The signed-off dry-runs (§4) with exact shapes.

import { ACTION_HOLDERS, isChaseable, type Party } from "../action-holders";
import { deriveChaseAsk } from "../derive-chase-ask";

const ALL_RECIPIENTS: Party[] = [
  "seller",
  "buyer",
  "seller_solicitor",
  "buyer_solicitor",
  "broker",
];

const NAME = "SELECTED MILESTONE NAME";
const codes = Object.keys(ACTION_HOLDERS);

describe("invariants across every milestone x every recipient", () => {
  for (const code of codes) {
    for (const recipientRole of ALL_RECIPIENTS) {
      it(`${code} -> ${recipientRole} keeps the subject and never invents`, () => {
        const ask = deriveChaseAsk({ milestoneCode: code, milestoneName: NAME, recipientRole });

        // The subject is ALWAYS the selected milestone, never substituted.
        expect(ask.milestoneBeingChased).toBe(NAME);

        if (!isChaseable(code)) {
          expect(ask.chaseable).toBe(false);
          expect(ask.shape).toBe("NOT_CHASED");
          expect(ask.recipientAction).toBe("");
          return;
        }

        // Chaseable: there is always a real ask, and it names the selected
        // milestone (the function only ever interpolates that name — structural
        // proof it can't drift to a neighbour).
        expect(ask.chaseable).toBe(true);
        expect(ask.shape).not.toBe("NOT_CHASED");
        expect(ask.recipientAction.length).toBeGreaterThan(0);
        expect(ask.recipientAction).toContain(NAME);

        // actionHolderRole matches the map; recipientIsActionHolder is truthful.
        expect(ask.actionHolderRole).toBe(ACTION_HOLDERS[code].holder);
        expect(ask.recipientIsActionHolder).toBe(recipientRole === ACTION_HOLDERS[code].holder);
      });
    }
  }
});

describe("unknown code is not chaseable", () => {
  it("returns NOT_CHASED", () => {
    const ask = deriveChaseAsk({ milestoneCode: "ZZ99", milestoneName: NAME, recipientRole: "seller" });
    expect(ask.chaseable).toBe(false);
    expect(ask.shape).toBe("NOT_CHASED");
  });
});

describe("signed-off dry-runs (§4)", () => {
  const run = (milestoneCode: string, recipientRole: Party, milestoneName = NAME) =>
    deriveChaseAsk({ milestoneCode, milestoneName, recipientRole });

  it("1. VM7 -> seller: VIA_OWN_SOLICITOR, not the action-holder, no forms invented", () => {
    const a = run("VM7", "seller");
    expect(a.shape).toBe("VIA_OWN_SOLICITOR");
    expect(a.recipientIsActionHolder).toBe(false);
    expect(a.recipientAction).not.toMatch(/form/i);
  });

  it("2. VM7 -> seller's solicitor: ASK_DIRECT, is the action-holder", () => {
    const a = run("VM7", "seller_solicitor");
    expect(a.shape).toBe("ASK_DIRECT");
    expect(a.recipientIsActionHolder).toBe(true);
  });

  it("3. VM6 -> seller: ASK_DIRECT (client owns it — forms ARE the milestone)", () => {
    const a = run("VM6", "seller");
    expect(a.shape).toBe("ASK_DIRECT");
    expect(a.recipientIsActionHolder).toBe(true);
  });

  it("4. PM9 -> buyer: ASK_DIRECT (client owns it)", () => {
    const a = run("PM9", "buyer");
    expect(a.shape).toBe("ASK_DIRECT");
    expect(a.recipientIsActionHolder).toBe(true);
  });

  it("5. PM8 -> buyer: VIA_OWN_SOLICITOR", () => {
    const a = run("PM8", "buyer");
    expect(a.shape).toBe("VIA_OWN_SOLICITOR");
    expect(a.recipientIsActionHolder).toBe(false);
  });

  it("6. PM8 -> buyer's solicitor: ASK_DIRECT", () => {
    const a = run("PM8", "buyer_solicitor");
    expect(a.shape).toBe("ASK_DIRECT");
    expect(a.recipientIsActionHolder).toBe(true);
  });

  it("7. PM7 -> buyer: VIA_OWN_SOLICITOR with cross-side tail to the seller's solicitor", () => {
    const a = run("PM7", "buyer");
    expect(a.shape).toBe("VIA_OWN_SOLICITOR");
    expect(a.recipientAction).toContain("the seller's solicitor");
  });

  it("8. VM10 -> seller: VIA_OWN_SOLICITOR with cross-side tail to the buyer's solicitor (real ask, no invented task)", () => {
    const a = run("VM10", "seller");
    expect(a.shape).toBe("VIA_OWN_SOLICITOR");
    expect(a.recipientAction).toContain("the buyer's solicitor");
  });

  it("9. PM7 -> seller's solicitor (the sender): ASK_DIRECT, send it over", () => {
    const a = run("PM7", "seller_solicitor");
    expect(a.shape).toBe("ASK_DIRECT");
    expect(a.recipientAction).toMatch(/issue or send/i);
  });

  it("10. PM5 -> buyer and -> broker: VIA_BROKER", () => {
    expect(run("PM5", "buyer").shape).toBe("VIA_BROKER");
    expect(run("PM5", "broker").shape).toBe("VIA_BROKER");
  });

  it("11. notifications VM19/VM20/PM26/PM27: NOT_CHASED", () => {
    for (const c of ["VM19", "VM20", "PM26", "PM27"]) {
      expect(run(c, "seller").chaseable).toBe(false);
    }
  });

  it("12. VM21 tracker: NOT_CHASED", () => {
    expect(run("VM21", "seller").chaseable).toBe(false);
  });
});
