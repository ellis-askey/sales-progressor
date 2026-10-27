import { signatureHasSignOff, shouldAddSignOff } from "@/lib/email/sign-off";

describe("signatureHasSignOff", () => {
  it("detects a pasted signature that opens with a sign-off (any common wording)", () => {
    // Danny-style: custom signature whose first line is the sign-off.
    expect(signatureHasSignOff(`<p>Best regards,</p><div>Danny Bailey CELA</div>`)).toBe(true);
    expect(signatureHasSignOff(`<div>Kind regards,</div><div>Jo</div>`)).toBe(true);
    expect(signatureHasSignOff(`Many thanks,<br>Sam`)).toBe(true);
    expect(signatureHasSignOff(`<p>Yours sincerely,</p>`)).toBe(true);
    expect(signatureHasSignOff(`<p>Cheers</p><p>Alex</p>`)).toBe(true);
  });

  it("returns false for a block-only signature (name / title / contact first)", () => {
    expect(signatureHasSignOff(`<div style="font-weight:700;">Danny Bailey CELA</div><div>Acme Estates</div>`)).toBe(false);
    expect(signatureHasSignOff(`Ellis Askey\nHillcrest Estates\n07700 900123`)).toBe(false);
  });

  it("treats an image-only signature as already having one (can't read inside the image)", () => {
    expect(signatureHasSignOff(`<div style="margin-top:22px;"><img src="https://x/sig.png" alt="" /></div>`)).toBe(true);
  });

  it("does not false-positive on a long first line that merely contains a sign-off word", () => {
    expect(signatureHasSignOff(`<div>The best agents in town, call us today</div>`)).toBe(false);
  });

  it("is punctuation- and case-insensitive on the sign-off line", () => {
    expect(signatureHasSignOff(`<p>BEST REGARDS</p><p>Jo</p>`)).toBe(true);
    expect(signatureHasSignOff(`<p>best wishes.</p>`)).toBe(true);
  });

  it("no signature at all means add ours (shouldAddSignOff true)", () => {
    expect(shouldAddSignOff(null)).toBe(true);
    expect(shouldAddSignOff(undefined)).toBe(true);
    expect(shouldAddSignOff("")).toBe(true);
  });

  it("shouldAddSignOff is the inverse for a present signature", () => {
    expect(shouldAddSignOff(`<p>Best regards,</p><div>Danny</div>`)).toBe(false); // has one -> don't add
    expect(shouldAddSignOff(`<div>Danny Bailey CELA</div>`)).toBe(true); // block only -> add ours
  });
});
