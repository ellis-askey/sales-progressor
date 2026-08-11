/**
 * @jest-environment node
 */

// Tests for the milestone-confirmation batching layer.
//
// Covers the six scenarios the brief calls out:
//   1. Single-event drain — N=1 sends the row's payload verbatim.
//   2. 2-event digest, same side — single section, sorted by JOURNEY_ORDER.
//   3. 2-event digest, mixed sides — both sections with correct labels.
//   4. PR 2 suppression preserved across two sequential confirmations.
//   5. Harder case: both halves of a bilateral pair within the window —
//      the already-queued row for the suppressed side is NOT cancelled;
//      the new confirmation's row enqueues only for the un-suppressed side.
//   6. Digest sort order — reverse-input renders in journey order.
//
// Tests 1, 2, 3, 6 are pure-function tests on assembleMilestoneDigest /
// decideSendForGroup / groupByRecipient.
// Tests 4 and 5 verify the PR 2 suppression decisions that gate
// enqueueing in sendRichMilestoneEmails — verifying the decision
// matches the user's framing exactly.

import {
  assembleMilestoneDigest,
  collapseBilateralPairs,
  getMilestoneDigestLine,
  actedSideForCode,
  type MilestoneDigestPayload,
} from "@/lib/email/milestone-digest";
import {
  decideSendForGroup,
  groupByRecipient,
} from "@/lib/email/milestone-digest-drain";
import { computeBilateralSuppressedRecipient } from "@/lib/email-skeletons/journey-order";

// ── Helpers ───────────────────────────────────────────────────────────────

function makePayload(overrides: Partial<MilestoneDigestPayload> = {}): MilestoneDigestPayload {
  return {
    subject: "default subject",
    text: "default text",
    html: "<p>default html</p>",
    milestoneCode: "VM1",
    recipientSide: "vendor",
    address: "22 Example Road, London SW1A 1AA",
    firstName: "Alex",
    portalUrl: "https://example.com/portal/abc/progress",
    ...overrides,
  };
}

// Minimal "row" shape that mirrors the OutboundEmailQueue row fields
// the drain helpers consume. recipientContactId + payload + id +
// recipientEmail are all that's used.
type FakeRow = {
  id: string;
  recipientContactId: string | null;
  recipientEmail: string;
  payload: MilestoneDigestPayload;
};

function makeRow(id: string, contactId: string, payload: MilestoneDigestPayload): FakeRow {
  return {
    id,
    recipientContactId: contactId,
    recipientEmail: "alex@example.com",
    payload,
  };
}

// ── 1. Single-event drain ────────────────────────────────────────────────

describe("1. Single-event drain", () => {
  test("N=1 returns single mode with the row's payload verbatim", () => {
    const payload = makePayload({
      subject: "Your solicitor's instructed, 22 Example Road, London SW1A 1AA",
      text: "Hi Alex,\n\nYour solicitor's instructed. ...\n\n→ View your portal: https://...",
      html: "<p>Hi Alex,</p><p>Your solicitor's instructed. ...</p>",
      milestoneCode: "VM1",
    });
    const row = makeRow("row-1", "contact-1", payload);
    const decision = decideSendForGroup([row]);

    expect(decision.mode).toBe("single");
    if (decision.mode !== "single") return;
    expect(decision.row.id).toBe("row-1");
    expect(decision.payload.subject).toBe(payload.subject);
    expect(decision.payload.text).toBe(payload.text);
    expect(decision.payload.html).toBe(payload.html);
  });
});

// ── 2. 2-event digest, same side (sorted by journey order) ───────────────

describe("2. 2-event digest, same side", () => {
  test("two acted-side events for vendor render one section in JOURNEY_ORDER", () => {
    // VM4 (Phase 3) and VM6 (Phase 4) — both vendor acted-side events.
    const payloads = [
      makePayload({ milestoneCode: "VM6", recipientSide: "vendor" }),
      makePayload({ milestoneCode: "VM4", recipientSide: "vendor" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.subject).toBe("Updates on 22 Example Road, London SW1A 1AA");
    expect(assembled.acted.items).toHaveLength(2);
    expect(assembled.counterpart.items).toHaveLength(0);
    // VM4 comes before VM6 in JOURNEY_ORDER (Phase 3 < Phase 4).
    expect(assembled.acted.items[0].milestoneCode).toBe("VM4");
    expect(assembled.acted.items[1].milestoneCode).toBe("VM6");
    expect(assembled.text).toContain("What you've confirmed today:");
    // Single-section digest omits the counterpart heading.
    expect(assembled.text).not.toContain("What's happened on the");
  });

  test("two acted-side events for purchaser render with correct labels", () => {
    const payloads = [
      makePayload({ milestoneCode: "PM4", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM3", recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items).toHaveLength(2);
    expect(assembled.acted.items[0].milestoneCode).toBe("PM3");
    expect(assembled.acted.items[1].milestoneCode).toBe("PM4");
    expect(assembled.text).toContain("Hi Alex,");
    expect(assembled.text).toContain("→ View your portal:");
  });
});

// ── 3. 2-event digest, mixed sides ───────────────────────────────────────

describe("3. 2-event digest, mixed sides", () => {
  test("one acted + one counterpart event renders two sections (vendor recipient)", () => {
    // Vendor recipient. VM4 = vendor acted-side. PM4 = vendor counterpart
    // (PM* code; counterpart for vendor).
    const payloads = [
      makePayload({ milestoneCode: "PM4", recipientSide: "vendor" }),
      makePayload({ milestoneCode: "VM4", recipientSide: "vendor" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items).toHaveLength(1);
    expect(assembled.acted.items[0].milestoneCode).toBe("VM4");
    expect(assembled.counterpart.items).toHaveLength(1);
    expect(assembled.counterpart.items[0].milestoneCode).toBe("PM4");

    // Counterpart label for a vendor recipient names the buyer's side.
    expect(assembled.counterpart.heading).toBe("What's happened on the buyer's side:");

    // Both sections should appear in the rendered text.
    expect(assembled.text).toContain("What you've confirmed today:");
    expect(assembled.text).toContain("What's happened on the buyer's side:");
    // Acted section comes before counterpart section.
    expect(assembled.text.indexOf("What you've confirmed today:"))
      .toBeLessThan(assembled.text.indexOf("What's happened on the buyer's side:"));
  });

  test("counterpart heading for purchaser recipient names the seller's side", () => {
    const payloads = [
      makePayload({ milestoneCode: "VM1", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM1", recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["PM1"]);
    expect(assembled.counterpart.items.map((i) => i.milestoneCode)).toEqual(["VM1"]);
    expect(assembled.counterpart.heading).toBe("What's happened on the seller's side:");
  });
});

// ── 4. Bilateral suppression preserved (sequential confirmations) ────────

describe("4. Bilateral suppression preserved across sequential confirmations", () => {
  // Scenario: side A confirms first → A's row queued; later side B confirms
  // → B's row queued, A NOT re-enqueued because PR 2 suppresses A.
  // Trace: VM7 (seller acts) at t=0, PM7 (buyer acts) at some later
  // confirmation (counterpartComplete=true by then).
  test("VM7 fired first (counterpart not complete) does NOT suppress; both sides enqueue", () => {
    // direction = "default" — VM7 is natural first-actor, no counterpart yet.
    expect(computeBilateralSuppressedRecipient("VM7", "default")).toBeNull();
  });

  test("PM7 fired second (counterpart complete) suppresses vendor — VM7's acted side", () => {
    // direction = "default" — PM7 is natural second-actor, counterpart
    // already complete → second confirmation → suppress vendor.
    expect(computeBilateralSuppressedRecipient("PM7", "default")).toBe("vendor");
  });

  test("the suppressed side is precisely the side whose row was queued in the prior confirmation", () => {
    // The sequence VM7→PM7 queues a vendor row at VM7. At PM7 (second
    // confirmation), the suppression rule must skip enqueueing for vendor
    // so the existing row R_V is left in the queue as-is. PR 2's helper
    // gives "vendor" as the suppressed recipient — matches.
    const suppressedAtSecond = computeBilateralSuppressedRecipient("PM7", "default");
    const actedSideOfFirstConfirmation = actedSideForCode("VM7");
    expect(suppressedAtSecond).toBe(actedSideOfFirstConfirmation);
  });
});

// ── 5. Harder case (both halves within the 3-minute window) ──────────────

describe("5. Harder case: both halves of a bilateral pair within the window", () => {
  // Scenario: agent ticks VM7 at t=0 then PM7 at t=2min. Drain at
  // t=3min+. The queue state should be:
  //   • Vendor recipient: 1 row — VM7 acted-side from t=0
  //   • Purchaser recipient: 2 rows — VM7 hand-off nudge from t=0 +
  //     PM7 acted-side from t=2min
  // The PR 2 suppression at PM7's confirmation must NOT touch the
  // already-queued vendor row from t=0.

  test("VM7 first confirmation: both vendor and purchaser enqueue (no suppression)", () => {
    expect(computeBilateralSuppressedRecipient("VM7", "default")).toBeNull();
  });

  test("PM7 second confirmation: vendor is suppressed (no NEW row), purchaser enqueues", () => {
    expect(computeBilateralSuppressedRecipient("PM7", "default")).toBe("vendor");
  });

  test("vendor's existing row from t=0 stays in queue and drains as single send", () => {
    // The queue has one vendor row (from VM7 at t=0). PR 2 at t=2min
    // doesn't reach into the queue to delete — it only decides whether
    // to enqueue a NEW row. So vendor's existing row is still there.
    const vendorRows = [makeRow("R_V1", "vendor-contact", makePayload({
      milestoneCode: "VM7",
      recipientSide: "vendor",
      subject: "Contract pack issued to the buyer's side, 22 Example Road",
      text: "Hi Alex,\n\nThe draft contract pack has gone across...",
      html: "<p>Hi Alex,</p>...",
    }))];

    const decision = decideSendForGroup(vendorRows);
    expect(decision.mode).toBe("single");
    if (decision.mode !== "single") return;
    expect(decision.payload.milestoneCode).toBe("VM7");
    // Body is the locked single-event copy, not re-routed through digest.
    expect(decision.payload.text).toContain("The draft contract pack has gone across");
  });

  test("purchaser's two rows (handoff nudge + acted-side) drain as a digest", () => {
    // VM7 hand-off nudge to purchaser (from t=0) + PM7 acted-side
    // (from t=2min). Both are purchaser-side rows; digest combines them.
    const purchaserRows = [
      makeRow("R_P1", "purchaser-contact", makePayload({
        milestoneCode: "VM7",  // for the purchaser, this is the COUNTERPART event
        recipientSide: "purchaser",
        // The single-event body is the hand-off nudge body
        subject: "Contract pack on its way to your solicitor, 22 Example Road",
        text: "Hi Alex,\n\nThe draft contract pack has been issued by the seller's side, and it's on its way to your solicitor.",
        html: "<p>Hi Alex,</p>...",
      })),
      makeRow("R_P2", "purchaser-contact", makePayload({
        milestoneCode: "PM7",  // for the purchaser, this is the ACTED side
        recipientSide: "purchaser",
        subject: "You've confirmed the contract pack has arrived, 22 Example Road",
        text: "Hi Alex,\n\nThanks. You've confirmed your solicitor has the draft contract pack...",
        html: "<p>Hi Alex,</p>...",
      })),
    ];

    const decision = decideSendForGroup(purchaserRows);
    expect(decision.mode).toBe("digest");
    if (decision.mode !== "digest") return;

    // Pair-collapse (2026-08-11): both halves of the VM7/PM7 pair are in
    // the same recipient's digest, so the counterpart half (VM7) sheds
    // and the acted half (PM7) carries the event. One bullet, not two
    // near-identical ones.
    expect(decision.assembled.acted.items).toHaveLength(1);
    expect(decision.assembled.acted.items[0].milestoneCode).toBe("PM7");
    expect(decision.assembled.counterpart.items).toHaveLength(0);

    // Subject is the digest subject, not either single-event subject.
    expect(decision.assembled.subject).toBe("Updates on 22 Example Road, London SW1A 1AA");

    // Neither single-event subject leaks into the digest body.
    expect(decision.assembled.text).not.toContain("Contract pack on its way");
  });

  test("each row maps to exactly one send (no duplicates)", () => {
    // Combine vendor (1 row) + purchaser (2 rows) into the grouping
    // step, confirm the partition counts.
    const rows: FakeRow[] = [
      makeRow("R_V1", "vendor-contact", makePayload({ milestoneCode: "VM7", recipientSide: "vendor" })),
      makeRow("R_P1", "purchaser-contact", makePayload({ milestoneCode: "VM7", recipientSide: "purchaser" })),
      makeRow("R_P2", "purchaser-contact", makePayload({ milestoneCode: "PM7", recipientSide: "purchaser" })),
    ];
    const groups = groupByRecipient(rows);

    expect(groups.size).toBe(2);
    expect(groups.get("vendor-contact")).toHaveLength(1);
    expect(groups.get("purchaser-contact")).toHaveLength(2);

    // Confirm decisions: vendor → single, purchaser → digest. One send
    // per recipient, three rows accounted for in total.
    const vendorDecision = decideSendForGroup(groups.get("vendor-contact")!);
    const purchaserDecision = decideSendForGroup(groups.get("purchaser-contact")!);
    expect(vendorDecision.mode).toBe("single");
    expect(purchaserDecision.mode).toBe("digest");
  });
});

// ── 6. Digest sort order ─────────────────────────────────────────────────

describe("6. Digest sort order — reverse input renders in journey order", () => {
  test("acted-side items sort by JOURNEY_ORDER regardless of input order", () => {
    // Reverse input: VM6 (Phase 4) → VM3 (Phase 3) → VM1 (Phase 1).
    // Expected output: VM1 → VM3 → VM6.
    const payloads = [
      makePayload({ milestoneCode: "VM6", recipientSide: "vendor" }),
      makePayload({ milestoneCode: "VM3", recipientSide: "vendor" }),
      makePayload({ milestoneCode: "VM1", recipientSide: "vendor" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["VM1", "VM3", "VM6"]);
  });

  test("counterpart items sort by JOURNEY_ORDER independently of acted items", () => {
    // Purchaser recipient. Acted: PM4 (Phase 3) + PM1 (Phase 1).
    // Counterpart: VM6 (Phase 4) + VM2 (Phase 2). Reverse input.
    const payloads = [
      makePayload({ milestoneCode: "VM6", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM4", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "VM2", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM1", recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["PM1", "PM4"]);
    expect(assembled.counterpart.items.map((i) => i.milestoneCode)).toEqual(["VM2", "VM6"]);
  });

  test("text body renders items in journey order under each heading", () => {
    const payloads = [
      makePayload({ milestoneCode: "VM6", recipientSide: "vendor" }),
      makePayload({ milestoneCode: "VM1", recipientSide: "vendor" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    const vm1Line = getMilestoneDigestLine("VM1", "vendor");
    const vm6Line = getMilestoneDigestLine("VM6", "vendor");
    // VM1 appears before VM6 in the rendered body.
    expect(assembled.text.indexOf(vm1Line)).toBeLessThan(assembled.text.indexOf(vm6Line));
  });
});

// ── 7. Bilateral pair-collapse in the digest ─────────────────────────────

describe("7. Bilateral pair-collapse in the digest", () => {
  // Ellis's exact 2026-08-11 case: agent confirms VM12 (seller's
  // solicitor sent replies) then PM15 (buyer's solicitor received them)
  // in the same window. The buyer's digest previously carried both
  // lines, which say the same real-world thing twice.
  test("VM12+PM15 for the buyer renders one line (the acted ack), not two", () => {
    const payloads = [
      makePayload({ milestoneCode: "VM12", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM15", recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["PM15"]);
    expect(assembled.counterpart.items).toHaveLength(0);
    expect(assembled.text).toContain("Your solicitor has the seller's formal replies.");
    expect(assembled.text).not.toContain("The seller's solicitor has issued the formal replies.");
  });

  test("collapse only affects the pair; other items keep rendering", () => {
    const payloads = [
      makePayload({ milestoneCode: "VM12", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM15", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM13", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "VM6",  recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["PM13", "PM15"]);
    expect(assembled.counterpart.items.map((i) => i.milestoneCode)).toEqual(["VM6"]);
  });

  test("one half alone does NOT collapse", () => {
    const payloads = [
      makePayload({ milestoneCode: "VM12", recipientSide: "purchaser" }),
      makePayload({ milestoneCode: "PM13", recipientSide: "purchaser" }),
    ];
    const assembled = assembleMilestoneDigest(payloads);

    expect(assembled.acted.items.map((i) => i.milestoneCode)).toEqual(["PM13"]);
    expect(assembled.counterpart.items.map((i) => i.milestoneCode)).toEqual(["VM12"]);
  });

  test("collapseBilateralPairs maps the absorbed rows onto the kept bullet", () => {
    expect(collapseBilateralPairs(["VM12", "PM15"], "purchaser")).toEqual([
      { milestoneCode: "PM15", absorbedCodes: ["VM12"] },
    ]);
  });

  test("vendor recipient keeps the vendor half of a pair", () => {
    expect(collapseBilateralPairs(["VM12", "PM15"], "vendor")).toEqual([
      { milestoneCode: "VM12", absorbedCodes: ["PM15"] },
    ]);
  });

  test("non-pair codes pass through untouched", () => {
    expect(collapseBilateralPairs(["VM1", "PM4"], "vendor")).toEqual([
      { milestoneCode: "VM1", absorbedCodes: [] },
      { milestoneCode: "PM4", absorbedCodes: [] },
    ]);
  });
});

// ── 8. Edited digest override ────────────────────────────────────────────

describe("8. Edited digest override (review tray edit of the merged email)", () => {
  test("a group carrying digestOverride sends the edited subject + body verbatim", () => {
    const override = { subject: "A quick update from us", text: "Hi Alex,\n\nThe seller's replies are in and your solicitor is reviewing them." };
    const rows = [
      makeRow("r1", "c1", makePayload({ milestoneCode: "VM12", recipientSide: "purchaser", digestOverride: override })),
      makeRow("r2", "c1", makePayload({ milestoneCode: "PM15", recipientSide: "purchaser", digestOverride: override })),
    ];

    const decision = decideSendForGroup(rows);
    expect(decision.mode).toBe("digest");
    if (decision.mode !== "digest") return;
    expect(decision.assembled.subject).toBe(override.subject);
    expect(decision.assembled.text).toBe(override.text);
    // HTML is re-rendered from the edited text, not assembled from lines.
    expect(decision.assembled.html).toContain("your solicitor is reviewing them");
    expect(decision.assembled.html).not.toContain("What you&#39;ve confirmed today");
  });

  test("a group without digestOverride assembles from digest lines as before", () => {
    const rows = [
      makeRow("r1", "c1", makePayload({ milestoneCode: "VM4", recipientSide: "vendor" })),
      makeRow("r2", "c1", makePayload({ milestoneCode: "VM6", recipientSide: "vendor" })),
    ];
    const decision = decideSendForGroup(rows);
    expect(decision.mode).toBe("digest");
    if (decision.mode !== "digest") return;
    expect(decision.assembled.subject).toBe("Updates on 22 Example Road, London SW1A 1AA");
  });
});

// ── Misc behavioural guards ──────────────────────────────────────────────

describe("decideSendForGroup edge cases", () => {
  test("empty group throws", () => {
    expect(() => decideSendForGroup([])).toThrow();
  });
});

describe("assembleMilestoneDigest edge cases", () => {
  test("called with N=1 throws (single sends must NOT route through here)", () => {
    expect(() =>
      assembleMilestoneDigest([makePayload({ milestoneCode: "VM1" })]),
    ).toThrow(/N>=2 required/);
  });
});

describe("groupByRecipient", () => {
  test("groups rows by recipientContactId", () => {
    const rows = [
      { recipientContactId: "a", payload: makePayload() },
      { recipientContactId: "b", payload: makePayload() },
      { recipientContactId: "a", payload: makePayload() },
    ];
    const grouped = groupByRecipient(rows);
    expect(grouped.size).toBe(2);
    expect(grouped.get("a")).toHaveLength(2);
    expect(grouped.get("b")).toHaveLength(1);
  });

  test("skips rows with null recipientContactId (defensive)", () => {
    const rows = [
      { recipientContactId: null, payload: makePayload() },
      { recipientContactId: "a", payload: makePayload() },
    ];
    const grouped = groupByRecipient(rows);
    expect(grouped.size).toBe(1);
    expect(grouped.get("a")).toHaveLength(1);
  });
});

describe("getMilestoneDigestLine", () => {
  test("returns the acted-side line when recipient matches the milestone's acted side", () => {
    // VM* code, vendor recipient → acted.
    expect(getMilestoneDigestLine("VM1", "vendor")).toBe("You've instructed your solicitor.");
    // PM* code, purchaser recipient → acted.
    expect(getMilestoneDigestLine("PM1", "purchaser")).toBe("You've instructed your solicitor.");
  });

  test("returns the counterpart line when recipient is the other side", () => {
    expect(getMilestoneDigestLine("VM1", "purchaser")).toBe("The seller's solicitor is instructed.");
    expect(getMilestoneDigestLine("PM1", "vendor")).toBe("The buyer's solicitor is instructed.");
  });

  test("throws on unknown milestone code (defensive)", () => {
    expect(() => getMilestoneDigestLine("XX99", "vendor")).toThrow(/no digest line/);
  });

  // Regression guard for Job B's three new counterpart sides — the digest
  // lookup must return non-empty for the new sides, otherwise the drain
  // assembler throws and the whole group fails (see audit §5 finding C1
  // which caught this exact gap before this commit).
  test("Job B counterpart lines: VM9.purchaser, VM17.purchaser, PM10.vendor", () => {
    expect(getMilestoneDigestLine("VM9",  "purchaser"))
      .toBe("The seller's solicitor has received the management pack.");
    expect(getMilestoneDigestLine("VM17", "purchaser"))
      .toBe("The seller has signed and returned their contracts.");
    expect(getMilestoneDigestLine("PM10", "vendor"))
      .toBe("The buyer's survey report is in.");
  });
});
