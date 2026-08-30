import {
  attributionFromParams,
  hasAttribution,
  parseAttributionCookie,
  classifySource,
  type SignupAttribution,
} from "@/lib/analytics/attribution";

describe("attributionFromParams", () => {
  it("maps utm_* and sp_* handoff params to normalised fields", () => {
    const p = new URLSearchParams(
      "utm_source=google&utm_medium=organic&utm_campaign=spring&utm_term=chasing&utm_content=hero&sp_ref=lnkd.in&sp_landing=/pricing&sp_tier=self&sp_cta=pricing_page_self"
    );
    expect(attributionFromParams(p)).toEqual({
      source: "google",
      medium: "organic",
      campaign: "spring",
      term: "chasing",
      content: "hero",
      referrer: "lnkd.in",
      landingPage: "/pricing",
      tier: "self",
      ctaLocation: "pricing_page_self",
    });
  });

  it("returns undefined for absent params (no empty strings)", () => {
    const a = attributionFromParams(new URLSearchParams("utm_source=x"));
    expect(a.source).toBe("x");
    expect(a.medium).toBeUndefined();
    expect(hasAttribution(a)).toBe(true);
    expect(hasAttribution(attributionFromParams(new URLSearchParams("")))).toBe(false);
  });
});

describe("parseAttributionCookie", () => {
  it("round-trips a URI-encoded JSON cookie", () => {
    const a: SignupAttribution = { source: "linkedin", tier: "outsourced" };
    const cookie = encodeURIComponent(JSON.stringify(a));
    expect(parseAttributionCookie(cookie)).toEqual(a);
  });
  it("returns null for empty / malformed / attribution-less cookies", () => {
    expect(parseAttributionCookie(undefined)).toBeNull();
    expect(parseAttributionCookie("not json")).toBeNull();
    expect(parseAttributionCookie(encodeURIComponent(JSON.stringify({})))).toBeNull();
  });
});

describe("classifySource", () => {
  const cases: Array<[Partial<SignupAttribution>, string]> = [
    [{ source: "google", medium: "organic" }, "Organic Search"],
    [{ source: "google", medium: "cpc" }, "Paid"],
    [{ source: "linkedin", medium: "social" }, "LinkedIn"],
    [{ source: "linkedin", medium: "paid" }, "Paid"],
    [{ source: "instagram" }, "Instagram"],
    [{ referrer: "l.instagram.com" }, "Instagram"],
    [{ medium: "referral", referrer: "someblog.co.uk" }, "Referral"],
    [{ campaign: "launch" }, "Campaign"],
    [{}, "Direct / Unknown"],
  ];
  it.each(cases)("classifies %o as %s", (a, expected) => {
    expect(classifySource(a)).toBe(expected);
  });
});
