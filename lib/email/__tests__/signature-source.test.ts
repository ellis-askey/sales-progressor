/**
 * @jest-environment node
 */

import { detectSignatureSource, normalizeBySource } from "../signature-source";

describe("detectSignatureSource", () => {
  it("detects WiseStamp from its icon host", () => {
    expect(detectSignatureSource('<img src="https://gifo.srv.wisestamp.com/s/x/trans.png">')).toBe("wisestamp");
  });
  it("detects Outlook from mso markup", () => {
    expect(detectSignatureSource('<p class="MsoNormal">Hi</p>')).toBe("outlook");
  });
  it("detects Gmail", () => {
    expect(detectSignatureSource('<div class="gmail_signature">Hi</div>')).toBe("gmail");
  });
  it("falls back to other", () => {
    expect(detectSignatureSource("<p>Hi</p>")).toBe("other");
  });
});

describe("normalizeBySource — WiseStamp un-cramp", () => {
  const html =
    '<td style="width:128px"><p style="margin:0"><img src="https://x/i.png" style="width:10px"><a href="tel:01279211731">01279 211 731</a></p></td>';

  it("removes narrow fixed td widths and keeps the contact line on one line", () => {
    const out = normalizeBySource(html, "wisestamp");
    expect(out).not.toMatch(/width:\s*128px/i); // cramped cell width dropped
    expect(out).toMatch(/white-space:nowrap/i); // contact line stays beside its icon
  });

  it("keeps wide structural widths", () => {
    const wide = '<td style="width:436px">x</td>';
    expect(normalizeBySource(wide, "wisestamp")).toMatch(/width:\s*436px/i);
  });

  it("leaves non-generator sources untouched", () => {
    expect(normalizeBySource(html, "outlook")).toBe(html);
    expect(normalizeBySource(html, "other")).toBe(html);
  });
});
