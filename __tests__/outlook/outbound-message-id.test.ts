/**
 * PR2 — Email threading, outbound (Data Optionality capture-now).
 *
 * Proves:
 *  - buildOutboundMessageId produces a deterministic, RFC-shaped Message-ID.
 *  - sendEmail sets it as the "Message-ID" header ONLY when messageId is passed
 *    (so an inbound reply's In-Reply-To can later be matched to this send).
 *  - When no messageId is passed, sendEmail sets no headers — existing send
 *    behaviour is unchanged (regression guard for every current caller).
 *
 * @sendgrid/mail is mocked so nothing is actually sent.
 */

const sendMock = jest.fn().mockResolvedValue([{ statusCode: 202 }, {}]);
jest.mock("@sendgrid/mail", () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), send: sendMock },
}));

import { sendEmail, buildOutboundMessageId } from "@/lib/email";

function lastPayload(): Record<string, unknown> {
  return sendMock.mock.calls[sendMock.mock.calls.length - 1][0] as Record<string, unknown>;
}

describe("buildOutboundMessageId", () => {
  it("is deterministic and RFC-shaped", () => {
    const a = buildOutboundMessageId("queue-123");
    const b = buildOutboundMessageId("queue-123");
    expect(a).toBe(b);
    expect(a).toMatch(/^<sp-queue-123@[^>]+>$/);
  });

  it("varies with the seed", () => {
    expect(buildOutboundMessageId("a")).not.toBe(buildOutboundMessageId("b"));
  });
});

describe("sendEmail Message-ID header", () => {
  beforeEach(() => sendMock.mockClear());

  it("sets the Message-ID header when messageId is provided", async () => {
    const messageId = buildOutboundMessageId("q-abc");
    await sendEmail({
      to: "solicitor@agency.co.uk",
      subject: "Chasing enquiries",
      text: "Any update?",
      messageId,
    });
    const payload = lastPayload();
    expect(payload.headers).toEqual({ "Message-ID": messageId });
  });

  it("sets NO headers when messageId is omitted (unchanged behaviour)", async () => {
    await sendEmail({
      to: "solicitor@agency.co.uk",
      subject: "Chasing enquiries",
      text: "Any update?",
    });
    const payload = lastPayload();
    expect(payload.headers).toBeUndefined();
  });
});
