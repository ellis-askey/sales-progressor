/**
 * @jest-environment node
 */

// Backstop guard (2026-09): the send layer must never hand a reserved /
// non-deliverable address (RFC 2606 / RFC 6761) to SendGrid. Demo showcase
// files seed every contact @example.com "so nothing sends" — this proves the
// universal drop that makes that intent real, on every send path.

import { isNonDeliverableRecipient } from "@/lib/email";

describe("isNonDeliverableRecipient", () => {
  it("drops reserved example domains (what the demo seed uses)", () => {
    expect(isNonDeliverableRecipient("sarah.whitfield@example.com")).toBe(true);
    expect(isNonDeliverableRecipient("a@example.net")).toBe(true);
    expect(isNonDeliverableRecipient("a@example.org")).toBe(true);
  });

  it("drops reserved TLDs", () => {
    expect(isNonDeliverableRecipient("a@host.test")).toBe(true);
    expect(isNonDeliverableRecipient("a@anything.invalid")).toBe(true);
    expect(isNonDeliverableRecipient("a@box.localhost")).toBe(true);
    expect(isNonDeliverableRecipient("a@foo.example")).toBe(true);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isNonDeliverableRecipient("  Sarah@Example.COM  ")).toBe(true);
  });

  it("allows real recipients through", () => {
    expect(isNonDeliverableRecipient("ellis@thesalesprogressor.co.uk")).toBe(false);
    expect(isNonDeliverableRecipient("client@gmail.com")).toBe(false);
    // A domain that merely CONTAINS "example" but isn't reserved must send.
    expect(isNonDeliverableRecipient("hi@examplerealty.com")).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(isNonDeliverableRecipient("not-an-email")).toBe(false);
    expect(isNonDeliverableRecipient("")).toBe(false);
  });
});
