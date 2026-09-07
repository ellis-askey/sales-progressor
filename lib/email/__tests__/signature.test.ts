/**
 * @jest-environment node
 */

import { renderResolvedSignature } from "../signature";

const sigInput = {
  agentName: "Jane Doe",
  agentImageUrl: null,
  jobTitle: "Sales Manager",
  directMobile: "07123 456789",
  phone: null,
  agencyName: "Hartwell & Partners",
  agencyLogoBandHtml: null,
};

describe("renderResolvedSignature", () => {
  it("BASIC renders the auto signature, text part, and missing pieces", () => {
    const r = renderResolvedSignature({ mode: "BASIC", sigInput });
    expect(r.mode).toBe("BASIC");
    expect(r.html).toContain("Jane Doe");
    expect(r.text).toContain("Jane Doe");
    expect(r.missing).toContain("photo"); // no agentImageUrl
  });

  it("IMAGE renders an <img> when a url is present, with a text fallback", () => {
    const r = renderResolvedSignature({ mode: "IMAGE", sigInput, imageUrl: "https://cdn/sig.png" });
    expect(r.mode).toBe("IMAGE");
    expect(r.html).toContain("<img");
    expect(r.html).toContain("https://cdn/sig.png");
    expect(r.text).toContain("Jane Doe");
    expect(r.missing).toEqual([]);
  });

  it("IMAGE with no url falls back to BASIC (sender never left with nothing)", () => {
    const r = renderResolvedSignature({ mode: "IMAGE", sigInput, imageUrl: null });
    expect(r.mode).toBe("BASIC");
    expect(r.html).toContain("Jane Doe");
  });

  it("CUSTOM renders the pasted html verbatim (already sanitised at save)", () => {
    const r = renderResolvedSignature({ mode: "CUSTOM", sigInput, customHtml: "<p>Custom <b>sig</b></p>" });
    expect(r.mode).toBe("CUSTOM");
    expect(r.html).toContain("<p>Custom <b>sig</b></p>");
    expect(r.text).toContain("Jane Doe");
  });

  it("CUSTOM with empty html falls back to BASIC", () => {
    const r = renderResolvedSignature({ mode: "CUSTOM", sigInput, customHtml: "   " });
    expect(r.mode).toBe("BASIC");
  });

  it("IMAGE escapes the alt text", () => {
    const r = renderResolvedSignature({
      mode: "IMAGE",
      sigInput: { ...sigInput, agentName: 'A"B' },
      imageUrl: "https://cdn/s.png",
    });
    expect(r.html).toContain("&quot;");
  });
});
