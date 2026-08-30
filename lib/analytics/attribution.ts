// Signup attribution — the bridge from the marketing-site first-touch handoff
// to the Agency.signup* columns. Pure module (no server imports) so both the
// client register page and server signup paths can use it.
//
// The marketing site appends these params to the /register URL (see
// marketing-site/lib/utm.ts appendUtms): utm_source/medium/campaign/term/content,
// sp_ref (referrer host), sp_landing (landing path), sp_tier (self|outsourced),
// sp_cta (CTA location). We normalise them, persist a short-lived cookie so they
// survive the OAuth round-trip, and write the raw values onto the new Agency.
// Channel classification (classifySource) is a DISPLAY helper only — we store
// raw values and classify at read time.

export type SignupAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  referrer?: string;
  landingPage?: string;
  tier?: string; // "self" | "outsourced"
  ctaLocation?: string;
};

// Short-lived first-party cookie carrying the normalised attribution across the
// password POST and the OAuth redirect round-trip.
export const ATTRIBUTION_COOKIE = "sp_attribution";
export const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 30; // 30 minutes

export function attributionFromParams(params: URLSearchParams): SignupAttribution {
  const g = (k: string) => {
    const v = params.get(k)?.trim();
    return v ? v.slice(0, 200) : undefined; // cap length defensively
  };
  return {
    source: g("utm_source"),
    medium: g("utm_medium"),
    campaign: g("utm_campaign"),
    term: g("utm_term"),
    content: g("utm_content"),
    referrer: g("sp_ref"),
    landingPage: g("sp_landing"),
    tier: g("sp_tier"),
    ctaLocation: g("sp_cta"),
  };
}

export function hasAttribution(a: SignupAttribution | null | undefined): boolean {
  return !!a && Object.values(a).some((v) => !!v);
}

export function parseAttributionCookie(raw: string | undefined | null): SignupAttribution | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(decodeURIComponent(raw)) as SignupAttribution;
    return obj && typeof obj === "object" && hasAttribution(obj) ? obj : null;
  } catch {
    return null;
  }
}

// Coarse acquisition channel for reporting. Raw source/medium/referrer are the
// stored truth; this buckets them for the Growth dashboard.
export function classifySource(a: Pick<SignupAttribution, "source" | "medium" | "campaign" | "referrer">): string {
  const s = (a.source ?? "").toLowerCase();
  const m = (a.medium ?? "").toLowerCase();
  const r = (a.referrer ?? "").toLowerCase();
  const paid = /cpc|ppc|paid|display|ads?\b/.test(m) || /paid/.test(s);

  if (paid) return "Paid";
  if (s.includes("linkedin") || r.includes("linkedin")) return "LinkedIn";
  if (s.includes("instagram") || r.includes("instagram") || s.includes("facebook") || r.includes("facebook") || r.includes("fb.")) return "Instagram";
  if (/google|bing|duckduckgo|yahoo|ecosia/.test(s) || (/google|bing|duckduckgo|yahoo|ecosia/.test(r) && !s)) {
    return m === "organic" || !m ? "Organic Search" : "Paid";
  }
  if (a.campaign) return "Campaign";
  if (m === "referral" || (r && !s)) return "Referral";
  if (s) return s.charAt(0).toUpperCase() + s.slice(1);
  return "Direct / Unknown";
}
