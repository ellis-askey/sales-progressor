/**
 * @jest-environment node
 */

import { relativeHost } from "../dns-host";

describe("relativeHost", () => {
  it("strips the zone off a mail CNAME host", () => {
    expect(relativeHost("em1234.example.com", "example.com")).toBe("em1234");
  });
  it("strips the zone off a DKIM host, keeping the _domainkey label", () => {
    expect(relativeHost("s1._domainkey.example.com", "example.com")).toBe("s1._domainkey");
  });
  it("returns @ for the apex", () => {
    expect(relativeHost("example.com", "example.com")).toBe("@");
  });
  it("is case-insensitive and tolerates trailing dots", () => {
    expect(relativeHost("EM1234.Example.com.", "example.com")).toBe("EM1234");
  });
  it("handles multi-label domains", () => {
    expect(relativeHost("url9.mail.dannybaileyproperty.co.uk", "dannybaileyproperty.co.uk")).toBe("url9.mail");
  });
  it("returns the host unchanged if it does not sit under the domain", () => {
    expect(relativeHost("em1234.other.com", "example.com")).toBe("em1234.other.com");
  });
  it("is safe on empty input", () => {
    expect(relativeHost("", "example.com")).toBe("");
    expect(relativeHost("em1234.example.com", "")).toBe("em1234.example.com");
  });
});
