/**
 * @jest-environment node
 */
import { resolveBackTarget, withFrom } from "@/lib/agent/back-nav";

describe("resolveBackTarget", () => {
  test("no marker → falls back to the all-files list", () => {
    expect(resolveBackTarget(null)).toEqual({ href: "/agent/transactions", label: "Back to files" });
    expect(resolveBackTarget(undefined)).toEqual({ href: "/agent/transactions", label: "Back to files" });
    expect(resolveBackTarget("")).toEqual({ href: "/agent/transactions", label: "Back to files" });
  });

  test("maps known origins to friendly labels, preserving the href", () => {
    expect(resolveBackTarget("/agent/hub")).toEqual({ href: "/agent/hub", label: "Back to hub" });
    expect(resolveBackTarget("/agent/enquiries")).toEqual({ href: "/agent/enquiries", label: "Back to enquiries" });
    expect(resolveBackTarget("/agent/completions")).toEqual({ href: "/agent/completions", label: "Back to completions" });
    expect(resolveBackTarget("/agent/work-queue")).toEqual({ href: "/agent/work-queue", label: "Back to reminders" });
  });

  test("preserves the origin's query string (e.g. a filtered list)", () => {
    expect(resolveBackTarget("/agent/transactions?filter=withdrawn")).toEqual({
      href: "/agent/transactions?filter=withdrawn",
      label: "Back to files",
    });
    expect(resolveBackTarget("/agent/enquiries?sort=recent")).toEqual({
      href: "/agent/enquiries?sort=recent",
      label: "Back to enquiries",
    });
  });

  test("a file path (file → file) gets a plain 'Back' one step back", () => {
    expect(resolveBackTarget("/agent/transactions/abc123")).toEqual({ href: "/agent/transactions/abc123", label: "Back" });
  });

  test("decodes an encoded marker", () => {
    expect(resolveBackTarget(encodeURIComponent("/agent/enquiries"))).toEqual({
      href: "/agent/enquiries",
      label: "Back to enquiries",
    });
  });

  test("open-redirect guard: external / protocol-relative / junk → fallback", () => {
    expect(resolveBackTarget("https://evil.com")).toEqual({ href: "/agent/transactions", label: "Back to files" });
    expect(resolveBackTarget("//evil.com")).toEqual({ href: "/agent/transactions", label: "Back to files" });
    expect(resolveBackTarget("/command/overview")).toEqual({ href: "/agent/transactions", label: "Back to files" });
    expect(resolveBackTarget("/agent/ evil")).toEqual({ href: "/agent/transactions", label: "Back to files" });
  });
});

describe("withFrom", () => {
  test("appends an encoded from marker", () => {
    expect(withFrom("/agent/transactions/1", "/agent/enquiries")).toBe(
      "/agent/transactions/1?from=%2Fagent%2Fenquiries",
    );
  });
  test("uses & when the href already has a query", () => {
    expect(withFrom("/agent/transactions/1?tab=steps", "/agent/hub")).toBe(
      "/agent/transactions/1?tab=steps&from=%2Fagent%2Fhub",
    );
  });
  test("no origin → href unchanged", () => {
    expect(withFrom("/agent/transactions/1", "")).toBe("/agent/transactions/1");
  });
  test("round-trips through resolveBackTarget", () => {
    const link = withFrom("/agent/transactions/1", "/agent/enquiries?sort=recent");
    const from = new URLSearchParams(link.split("?")[1]).get("from");
    expect(resolveBackTarget(from)).toEqual({ href: "/agent/enquiries?sort=recent", label: "Back to enquiries" });
  });
});
