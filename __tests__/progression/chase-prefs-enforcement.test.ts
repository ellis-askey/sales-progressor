/**
 * @jest-environment node
 *
 * businessChaseAllows — the pure gate every chase engine consults before sending
 * when a file is run by an external progression business. Proves the load-bearing
 * semantics: no business / unknown / TSP always allow (the engine's own agency
 * rules apply); a non-TSP business blocks only the categories its owner switched
 * off. Also pins the raise-chase mapping: the "get enquiries raised" nudge is
 * gated under "solicitor", not "enquiries".
 */
import { businessChaseAllows } from "@/lib/services/progressor-chase-prefs";

type Gate = Parameters<typeof businessChaseAllows>[0];

function gateWith(entries: Record<string, { isTsp: boolean; client: boolean; solicitor: boolean; enquiries: boolean; weekly: boolean; chain: boolean }>): Gate {
  const g: Gate = new Map();
  for (const [id, v] of Object.entries(entries)) g.set(id, v);
  return g;
}

const ALL_ON = { client: true, solicitor: true, enquiries: true, weekly: true, chain: true };

describe("businessChaseAllows", () => {
  it("allows when the file has no progression business (self-managed agency)", () => {
    const gate = gateWith({});
    expect(businessChaseAllows(gate, null, "client")).toBe(true);
    expect(businessChaseAllows(gate, undefined, "solicitor")).toBe(true);
  });

  it("allows when the business id is unknown to the gate (never silently blocks)", () => {
    const gate = gateWith({ biz_known: { isTsp: false, ...ALL_ON, solicitor: false } });
    expect(businessChaseAllows(gate, "biz_unknown", "solicitor")).toBe(true);
  });

  it("allows every category for a TSP business (engine's own rules apply)", () => {
    const gate = gateWith({ tsp: { isTsp: true, client: false, solicitor: false, enquiries: false, weekly: false, chain: false } });
    expect(businessChaseAllows(gate, "tsp", "client")).toBe(true);
    expect(businessChaseAllows(gate, "tsp", "solicitor")).toBe(true);
    expect(businessChaseAllows(gate, "tsp", "enquiries")).toBe(true);
  });

  it("blocks only the categories a non-TSP business switched off", () => {
    const gate = gateWith({ biz: { isTsp: false, client: true, solicitor: false, enquiries: true, weekly: false, chain: true } });
    expect(businessChaseAllows(gate, "biz", "client")).toBe(true);
    expect(businessChaseAllows(gate, "biz", "solicitor")).toBe(false);
    expect(businessChaseAllows(gate, "biz", "enquiries")).toBe(true);
    expect(businessChaseAllows(gate, "biz", "weekly")).toBe(false);
    expect(businessChaseAllows(gate, "biz", "chain")).toBe(true);
  });

  it("gates the raise-chase nudge under 'solicitor', independent of 'enquiries'", () => {
    // Enquiry raising is part of solicitor chasing. A business that turned off
    // solicitor chases but kept enquiry (reply) chases on must stop the raise nudge.
    const gate = gateWith({ biz: { isTsp: false, client: true, solicitor: false, enquiries: true, weekly: true, chain: true } });
    expect(businessChaseAllows(gate, "biz", "solicitor")).toBe(false); // raise nudge blocked
    expect(businessChaseAllows(gate, "biz", "enquiries")).toBe(true);  // reply chase still allowed
  });
});
