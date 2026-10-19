/**
 * @jest-environment node
 *
 * Founder-brief send-failure footer. The footer is appended AFTER the AI body,
 * so it must render the exact named list deterministically — this covers the
 * empty, populated, and overflow shapes, plus the no-em-dash house rule.
 */

import { formatSendFailuresForBrief, type SendFailureSummary } from "@/lib/services/send-failures";

function summary(items: SendFailureSummary["items"]): SendFailureSummary {
  const byType: Record<string, number> = {};
  for (const i of items) byType[i.emailType] = (byType[i.emailType] ?? 0) + 1;
  return { total: items.length, byType, items };
}

const fail = (over: Partial<SendFailureSummary["items"][number]>): SendFailureSummary["items"][number] => ({
  emailType: "OUTSOURCE_INTRO",
  recipientEmail: "client@x.com",
  reason: "retry_age_exceeded",
  propertyAddress: "1 High St",
  owner: "Key To Completion",
  errorAt: new Date("2026-10-19T08:00:00Z"),
  ...over,
});

describe("formatSendFailuresForBrief", () => {
  it("reports an all-clear when nothing failed", () => {
    const text = formatSendFailuresForBrief(summary([]));
    expect(text).toContain("All client emails sent cleanly");
    expect(text).not.toContain("failed to send");
  });

  it("names each failure with its type, owner and property", () => {
    const text = formatSendFailuresForBrief(summary([
      fail({ emailType: "OUTSOURCE_INTRO", propertyAddress: "104 Lexden Road", owner: "Key To Completion" }),
      fail({ emailType: "CLIENT_CHASE", propertyAddress: "26 Perry Road", owner: "Moves By Wright" }),
    ]));
    expect(text).toContain("2 client emails failed to send");
    expect(text).toContain("Welcome/intro (Key To Completion): 104 Lexden Road");
    expect(text).toContain("Client chase (Moves By Wright): 26 Perry Road");
  });

  it("uses singular wording for a single failure", () => {
    const text = formatSendFailuresForBrief(summary([fail({})]));
    expect(text).toContain("1 client email failed to send");
  });

  it("falls back to the recipient email when there is no linked property", () => {
    const text = formatSendFailuresForBrief(summary([fail({ propertyAddress: null, owner: null, recipientEmail: "agent@x.com" })]));
    expect(text).toContain(": agent@x.com");
  });

  it("caps the list and summarises the remainder", () => {
    const many = Array.from({ length: 15 }, (_, i) => fail({ propertyAddress: `House ${i}` }));
    const text = formatSendFailuresForBrief(summary(many));
    expect(text).toContain("15 client emails failed to send");
    expect(text).toContain("and 3 more");
    expect(text).toContain("House 0");
    expect(text).not.toContain("House 12"); // beyond the cap of 12
  });

  it("contains no em-dashes (brief house style / Law 21)", () => {
    const text = formatSendFailuresForBrief(summary([fail({})]));
    expect(text).not.toMatch(/—/);
  });
});
