/**
 * @jest-environment node
 */

import { classifySmtpError, isSmtpAuthFailure, isTransientSmtpError } from "../errors";
import { resolveSmtpSettings } from "../../imap/config";

describe("isSmtpAuthFailure", () => {
  it("catches nodemailer EAUTH and SMTP 535", () => {
    expect(isSmtpAuthFailure({ code: "EAUTH", message: "Invalid login" })).toBe(true);
    expect(isSmtpAuthFailure({ responseCode: 535, response: "535 Authentication Failed" })).toBe(true);
    expect(isSmtpAuthFailure({ message: "Authentication failed" })).toBe(true);
  });
  it("does not flag non-auth failures", () => {
    expect(isSmtpAuthFailure({ code: "ETIMEDOUT" })).toBe(false);
    expect(isSmtpAuthFailure({ responseCode: 452, response: "too many messages" })).toBe(false);
    expect(isSmtpAuthFailure(null)).toBe(false);
  });
});

describe("isTransientSmtpError", () => {
  it("treats network problems (no responseCode) as transient", () => {
    expect(isTransientSmtpError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientSmtpError({ code: "ECONNECTION", message: "connect refused" })).toBe(true);
  });
  it("treats SMTP 4xx as transient and 5xx as permanent", () => {
    expect(isTransientSmtpError({ responseCode: 421 })).toBe(true);
    expect(isTransientSmtpError({ responseCode: 452 })).toBe(true);
    expect(isTransientSmtpError({ responseCode: 550 })).toBe(false);
  });
  it("treats auth failures as permanent even without a responseCode", () => {
    expect(isTransientSmtpError({ code: "EAUTH" })).toBe(false);
  });
});

describe("classifySmtpError", () => {
  it("gives an app-password hint on auth failure", () => {
    expect(classifySmtpError({ code: "EAUTH" })).toContain("app-password");
  });
  it("names rate limiting for 4xx", () => {
    expect(classifySmtpError({ responseCode: 452, response: "too many" })).toContain("sending limit");
  });
  it("has a generic fallback", () => {
    expect(classifySmtpError({ message: "???" })).toContain("couldn't send");
  });
});

describe("resolveSmtpSettings", () => {
  it("derives Zoho EU submission for eXp UK mailboxes", () => {
    expect(resolveSmtpSettings("danny.bailey@expuk.com")).toEqual({
      host: "smtppro.zoho.eu",
      port: 465,
      secure: true,
    });
  });
  it("uses presets for the big providers", () => {
    expect(resolveSmtpSettings("a@gmail.com")?.host).toBe("smtp.gmail.com");
    expect(resolveSmtpSettings("a@outlook.com")).toEqual({ host: "smtp-mail.outlook.com", port: 587, secure: false });
  });
  it("returns null for an unknown domain with no stored override", () => {
    expect(resolveSmtpSettings("a@some-random-agency.co.uk")).toBeNull();
  });
  it("prefers a stored override and infers TLS from the port", () => {
    expect(resolveSmtpSettings("a@some-random-agency.co.uk", { host: "smtp.x.co.uk", port: 587 })).toEqual({
      host: "smtp.x.co.uk",
      port: 587,
      secure: false,
    });
  });
});
