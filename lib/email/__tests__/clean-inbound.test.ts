/**
 * @jest-environment node
 */

import { cleanIngestedEmail } from "../clean-inbound";

describe("cleanIngestedEmail", () => {
  it("keeps the new message and cuts an 'On … wrote:' quote chain", () => {
    const raw = [
      "Hi Sara,",
      "",
      "Any update on the enquiries?",
      "",
      "On 3 Sep 2026, at 11:01, Asim Haque <asim95@hotmail.co.uk> wrote:",
      "",
      "Hi both, previous message here.",
      "On 28 Aug 2026, at 15:18, Asim Haque wrote:",
      "even older",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe("Hi Sara,\n\nAny update on the enquiries?");
  });

  it("cuts an Outlook From:/Sent:/To: header block", () => {
    const raw = [
      "Thanks, that's received.",
      "",
      "From: kent@collective.legal",
      "Sent: 8 September 2026 09:54",
      "To: lucy.madley@neves.co.uk",
      "Subject: Re: 8 Brambling Crescent",
      "",
      "old quoted body",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe("Thanks, that's received.");
  });

  it("cuts the -----Original Message----- divider", () => {
    const raw = "New reply.\n\n-----Original Message-----\nFrom: someone\nold stuff";
    expect(cleanIngestedEmail(raw)).toBe("New reply.");
  });

  it("strips a confidentiality disclaimer footer", () => {
    const raw =
      "Please find the replies attached.\n\nIMPORTANT: The contents of this email and any attachments are confidential. They are intended for the named recipient(s) only.";
    expect(cleanIngestedEmail(raw)).toBe("Please find the replies attached.");
  });

  it("strips a '-- ' signature delimiter but keeps a normal sign-off", () => {
    const raw = "Message body.\n\nKind regards,\nSara\n\n-- \nSara Anwar | Collective Legal | 0123 456";
    expect(cleanIngestedEmail(raw)).toBe("Message body.\n\nKind regards,\nSara");
  });

  it("handles CRLF and empty input", () => {
    expect(cleanIngestedEmail("Hi\r\n\r\nOn 1 Jan 2026, X wrote:\r\nold")).toBe("Hi");
    expect(cleanIngestedEmail("")).toBe("");
    expect(cleanIngestedEmail(null)).toBe("");
  });

  it("cuts the dash-wrapped, colon-less 'On … wrote ----' variant", () => {
    const raw = [
      "I am chasing for the replies, when will everyone be ready to exchange?",
      "",
      "---- On Fri, 11 Sep 2026 14:25:45 +0100 Ellis Askey <Ellis@akeman-residential.co.uk> wrote ----",
      "",
      "old quoted body here",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe(
      "I am chasing for the replies, when will everyone be ready to exchange?",
    );
  });

  it("cuts a '----- Forwarded message -----' divider", () => {
    const raw = "Passing this on.\n\n---------- Forwarded message ----------\nFrom: someone\nold";
    expect(cleanIngestedEmail(raw)).toBe("Passing this on.");
  });

  it("does not over-cut a normal sentence starting with 'On' that mentions wrote", () => {
    const raw = "On reflection, what he wrote was fine and we can proceed.";
    expect(cleanIngestedEmail(raw)).toBe(
      "On reflection, what he wrote was fine and we can proceed.",
    );
  });

  it("removes inline cid image tokens without truncating the message", () => {
    const raw = "Please see the plan below.\n\n[cid:0.1784559350.8808149238238716469.1a094ee6404__inline__img__src]\n\nLet me know your thoughts.";
    expect(cleanIngestedEmail(raw)).toBe(
      "Please see the plan below.\n\nLet me know your thoughts.",
    );
  });

  it("removes Office image alt-text", () => {
    const raw = "Kind regards\n[A yellow circle with a black triangle in it Description automatically generated with medium confidence]";
    expect(cleanIngestedEmail(raw)).toBe("Kind regards");
  });

  it("cuts a social/brand signature token block but keeps the sign-off", () => {
    const raw = [
      "I am chasing for the replies.",
      "",
      "Kind regards,",
      "",
      "Ellis Askey",
      "Sales Progressor",
      "Akeman Residential",
      "",
      "[icon] 01442 974754",
      "[icon] 07508862929",
      "[facebook]<https://www.facebook.com/profile.php?id=100090129085171>",
      "[instagram]<https://instagram.com/akemanresidential>",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe(
      "I am chasing for the replies.\n\nKind regards,\n\nEllis Askey\nSales Progressor\nAkeman Residential",
    );
  });
});
