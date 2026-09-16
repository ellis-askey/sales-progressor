/**
 * @jest-environment node
 */

import { detectAutoReply } from "../auto-reply";

describe("detectAutoReply", () => {
  it("flags well-known auto-reply subjects", () => {
    expect(detectAutoReply({ subject: "Automatic reply: 8 Brambling Crescent" })).toBe(true);
    expect(detectAutoReply({ subject: "Out of office" })).toBe(true);
    expect(detectAutoReply({ subject: "Out of the Office - back Monday" })).toBe(true);
    expect(detectAutoReply({ subject: "Auto-Response" })).toBe(true);
  });

  it("strips leading Re:/Fwd: before matching the subject", () => {
    expect(detectAutoReply({ subject: "RE: Automatic reply" })).toBe(true);
    expect(detectAutoReply({ subject: "Fwd: Out of office" })).toBe(true);
  });

  it("does not flag a normal subject", () => {
    expect(detectAutoReply({ subject: "Re: replies to enquiries" })).toBe(false);
    expect(detectAutoReply({ subject: "Update on completion date" })).toBe(false);
    expect(detectAutoReply({ subject: "" })).toBe(false);
  });

  it("flags machine headers", () => {
    expect(detectAutoReply({ subject: "x", headers: { "auto-submitted": "auto-replied" } })).toBe(true);
    expect(detectAutoReply({ subject: "x", headers: { "auto-submitted": "auto-generated" } })).toBe(true);
    expect(detectAutoReply({ subject: "x", headers: { "x-autoreply": "yes" } })).toBe(true);
    expect(detectAutoReply({ subject: "x", headers: { "x-auto-response-suppress": "All" } })).toBe(true);
    expect(detectAutoReply({ subject: "x", headers: { precedence: "bulk" } })).toBe(true);
  });

  it("does not flag Auto-Submitted: no or absent headers", () => {
    expect(detectAutoReply({ subject: "x", headers: { "auto-submitted": "no" } })).toBe(false);
    expect(detectAutoReply({ subject: "x", headers: {} })).toBe(false);
    expect(detectAutoReply({ subject: "x" })).toBe(false);
  });
});
