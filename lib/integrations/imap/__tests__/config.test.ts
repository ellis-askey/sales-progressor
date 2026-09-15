/**
 * @jest-environment node
 */

import { presetForEmail, resolveImapSettings, domainOf } from "../config";

describe("domainOf", () => {
  it("extracts the lowercased domain", () => {
    expect(domainOf("Person@Gmail.com")).toBe("gmail.com");
    expect(domainOf("no-at-sign")).toBe("");
  });
});

describe("presetForEmail", () => {
  it("knows the big providers", () => {
    expect(presetForEmail("a@gmail.com")?.host).toBe("imap.gmail.com");
    expect(presetForEmail("a@googlemail.com")?.provider).toBe("gmail");
    expect(presetForEmail("a@outlook.com")?.host).toBe("outlook.office365.com");
    expect(presetForEmail("a@yahoo.co.uk")?.provider).toBe("yahoo");
    expect(presetForEmail("a@icloud.com")?.host).toBe("imap.mail.me.com");
  });
  it("returns null for an unknown domain", () => {
    expect(presetForEmail("a@some-random-agency.co.uk")).toBeNull();
  });
});

describe("resolveImapSettings", () => {
  it("uses the preset for a known provider", () => {
    expect(resolveImapSettings("a@gmail.com")).toEqual({
      provider: "gmail",
      host: "imap.gmail.com",
      port: 993,
      secure: true,
    });
  });

  it("returns null for an unknown provider with no host override", () => {
    expect(resolveImapSettings("a@unknown-domain.co.uk")).toBeNull();
  });

  it("accepts a manual host for an unknown provider (labelled generic imap)", () => {
    expect(resolveImapSettings("a@unknown-domain.co.uk", { host: "mail.unknown-domain.co.uk" })).toEqual({
      provider: "imap",
      host: "mail.unknown-domain.co.uk",
      port: 993,
      secure: true,
    });
  });

  it("derives non-TLS (STARTTLS) when a 143 port is given", () => {
    expect(resolveImapSettings("a@unknown-domain.co.uk", { host: "mail.x.co.uk", port: 143 })).toEqual({
      provider: "imap",
      host: "mail.x.co.uk",
      port: 143,
      secure: false,
    });
  });

  it("lets an explicit override win over the preset", () => {
    const r = resolveImapSettings("a@gmail.com", { host: "imap.custom.com", port: 993, secure: true });
    expect(r?.host).toBe("imap.custom.com");
  });
});
