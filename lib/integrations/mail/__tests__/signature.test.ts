/**
 * @jest-environment node
 */

import { extractSignaturePhone } from "../signature";

describe("extractSignaturePhone", () => {
  it("pulls a labelled mobile from a signature", () => {
    const body = [
      "Thanks, that all looks fine.",
      "",
      "Best regards,",
      "Jane Smith",
      "Acme Conveyancing",
      "M: 07700 900123",
      "E: jane@acme.co.uk",
    ].join("\n");
    expect(extractSignaturePhone(body)).toBe("+44 7700 900123");
  });

  it("handles a landline labelled Tel", () => {
    const body = "Regards\nJohn\nTel: 020 7946 0018";
    expect(extractSignaturePhone(body)).toBe("020 7946 0018");
  });

  it("accepts +44 international format", () => {
    const body = "Kind regards\nSam\nMobile +44 7911 123456";
    expect(extractSignaturePhone(body)).toBe("+44 7911 123456");
  });

  it("takes the last valid number when none is labelled", () => {
    const body = "Call the office on 01632 960111 if needed.\n\nCheers\nPat\n07700 900999";
    expect(extractSignaturePhone(body)).toBe("+44 7700 900999");
  });

  it("prefers a labelled number over an unlabelled one", () => {
    const body = "Our main line is 01632 960111.\nDirect: 07700 900222\nsome trailing text 01632 960555";
    expect(extractSignaturePhone(body)).toBe("+44 7700 900222");
  });

  it("returns null when there is no phone number", () => {
    expect(extractSignaturePhone("Thanks very much,\nJane\njane@acme.co.uk")).toBeNull();
  });

  it("ignores number-like noise that isn't a valid UK phone", () => {
    // Order refs, dates, and short numbers should not match.
    expect(extractSignaturePhone("Your ref 12345 dated 2026-09-16, 5 items")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractSignaturePhone("")).toBeNull();
  });
});
