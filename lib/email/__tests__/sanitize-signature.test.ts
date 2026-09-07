/**
 * @jest-environment node
 */

import { sanitizeSignatureHtml } from "../sanitize-signature";

describe("sanitizeSignatureHtml", () => {
  it("strips <script>", () => {
    const out = sanitizeSignatureHtml("<p>Hi</p><script>alert(1)</script>");
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("Hi");
  });

  it("strips inline event handlers", () => {
    const out = sanitizeSignatureHtml('<img src="https://x/a.png" width="100" height="20" onerror="alert(1)">');
    expect(out).not.toMatch(/onerror/i);
  });

  it("removes javascript: links", () => {
    const out = sanitizeSignatureHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("keeps https links, images and tables, and hardens links", () => {
    const out = sanitizeSignatureHtml(
      '<table><tbody><tr><td><a href="https://acme.co">Acme</a></td></tr></tbody></table><img src="https://x/logo.png" width="120" height="40">'
    );
    expect(out).toContain("<table");
    expect(out).toContain("https://acme.co");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain("<img");
  });

  it("drops 1x1 tracking pixels but keeps real content", () => {
    const out = sanitizeSignatureHtml('<img src="https://track/x.gif" width="1" height="1"><p>Real</p>');
    expect(out).not.toContain("track");
    expect(out).toContain("Real");
  });

  it("strips svg and iframe", () => {
    const out = sanitizeSignatureHtml('<svg onload="x"></svg><iframe src="https://e"></iframe><p>ok</p>');
    expect(out).not.toMatch(/<svg|<iframe/i);
    expect(out).toContain("ok");
  });

  it("blocks non-https (http) image sources", () => {
    const out = sanitizeSignatureHtml('<img src="http://insecure/a.png" width="50" height="50">');
    expect(out).not.toContain("http://insecure");
  });

  it("returns empty for empty input", () => {
    expect(sanitizeSignatureHtml("")).toBe("");
    expect(sanitizeSignatureHtml("   ")).toBe("");
  });
});
