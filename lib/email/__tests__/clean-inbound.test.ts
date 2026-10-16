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

  it("cuts at the sign-off, dropping the name and the '-- ' signature block", () => {
    const raw = "Message body.\n\nKind regards,\nSara\n\n-- \nSara Anwar | Collective Legal | 0123 456";
    expect(cleanIngestedEmail(raw)).toBe("Message body.");
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

  it("cuts at the sign-off, dropping the name and social/brand block", () => {
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
    expect(cleanIngestedEmail(raw)).toBe("I am chasing for the replies.");
  });

  it("cuts a plain-text solicitor signature at the sign-off", () => {
    const raw = [
      "We have responded to the other side solicitors and are waiting for the replies from the management company.",
      "",
      "Kind regards,",
      "Clear, Results-Driven Conveyancing Solicitors",
      "Aslam Abdul Caffar",
      "Collective Legal",
      "www.collective.legal",
      "Book a meeting with me",
      "All post to: WeWork, 5 Merchant Sq, London, W2 1AS",
      "Authorised by Solicitors Regulation Authority",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe(
      "We have responded to the other side solicitors and are waiting for the replies from the management company.",
    );
  });

  it("cuts a single-word sign-off when a signature follows", () => {
    const raw = "Any update on the enquiries?\n\nThanks\nJohn Smith\n01234 567890";
    expect(cleanIngestedEmail(raw)).toBe("Any update on the enquiries?");
  });

  it("keeps 'thanks' used inside a sentence", () => {
    const raw = "Thanks for sending the pack over. Could you also confirm the completion date?";
    expect(cleanIngestedEmail(raw)).toBe(
      "Thanks for sending the pack over. Could you also confirm the completion date?",
    );
  });

  it("keeps a bare 'Thanks.' when the message continues below it", () => {
    const raw = "Will do.\n\nThanks.\n\nAlso, can you confirm the completion date please?";
    expect(cleanIngestedEmail(raw)).toBe(
      "Will do.\n\nThanks.\n\nAlso, can you confirm the completion date please?",
    );
  });

  it("cuts at the real sign-off, not an earlier mid-email 'Thanks.'", () => {
    const raw = [
      "Thanks.",
      "",
      "One more thing: can you confirm the completion date?",
      "",
      "Kind regards,",
      "John Smith",
    ].join("\n");
    expect(cleanIngestedEmail(raw)).toBe(
      "Thanks.\n\nOne more thing: can you confirm the completion date?",
    );
  });

  it("does not cut when the sign-off has no content above it", () => {
    expect(cleanIngestedEmail("Kind regards,\nSara")).toBe("Kind regards,\nSara");
  });
});
