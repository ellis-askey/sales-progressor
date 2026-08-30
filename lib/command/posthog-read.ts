// Server-side PostHog READ layer for the Website & Growth page. Queries the
// PostHog HogQL API for the website-behaviour half (visitors, pages, sources,
// homepage section reach, CTA clicks). Mirrors the auth pattern already used by
// lib/services/signals/detectors/posthog-*.ts.
//
// Fully guarded: returns null when POSTHOG_API_KEY / POSTHOG_PROJECT_ID are unset
// (i.e. right now, since PostHog is off). The Growth page renders its
// TrackingDisabled state on null — never a fake zero. Credentials are read
// server-side only and never exposed to the client.

const QUERY_HOST = process.env.POSTHOG_QUERY_HOST ?? "https://eu.posthog.com";

export function isPosthogConfigured(): boolean {
  return !!process.env.POSTHOG_API_KEY && !!process.env.POSTHOG_PROJECT_ID;
}

function fmt(d: Date): string {
  // 'YYYY-MM-DD HH:MM:SS' for a HogQL toDateTime() literal.
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function hogql(query: string): Promise<unknown[][] | null> {
  const key = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!key || !projectId) return null;
  try {
    const res = await fetch(`${QUERY_HOST}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
      // Never cache growth numbers.
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[posthog-read] query failed ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { results?: unknown[][] };
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    console.warn("[posthog-read] query error", err);
    return null;
  }
}

const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const str = (v: unknown): string => (v == null ? "" : String(v));

export type WebsiteBehaviour = {
  visitors: number;
  pageviews: number;
  topPages: Array<{ path: string; views: number }>;
  topSources: Array<{ source: string; visitors: number }>;
  lastEventAt: string | null;
};

export async function getWebsiteBehaviour(start: Date, end: Date): Promise<WebsiteBehaviour | null> {
  if (!isPosthogConfigured()) return null;
  const where = `event = '$pageview' AND timestamp >= toDateTime('${fmt(start)}') AND timestamp < toDateTime('${fmt(end)}')`;
  const [totals, pages, sources, last] = await Promise.all([
    hogql(`SELECT count() AS pv, count(DISTINCT person_id) AS v FROM events WHERE ${where}`),
    hogql(`SELECT properties.$pathname AS path, count() AS views FROM events WHERE ${where} GROUP BY path ORDER BY views DESC LIMIT 12`),
    hogql(`SELECT coalesce(nullif(properties.$referring_domain, ''), '(direct)') AS src, count(DISTINCT person_id) AS v FROM events WHERE ${where} GROUP BY src ORDER BY v DESC LIMIT 12`),
    hogql(`SELECT max(timestamp) FROM events`),
  ]);
  if (totals == null) return null; // treat a failed totals query as "not available"
  return {
    pageviews: num(totals[0]?.[0]),
    visitors: num(totals[0]?.[1]),
    topPages: (pages ?? []).map((r) => ({ path: str(r[0]) || "/", views: num(r[1]) })),
    topSources: (sources ?? []).map((r) => ({ source: str(r[0]), visitors: num(r[1]) })),
    lastEventAt: last?.[0]?.[0] ? str(last[0][0]) : null,
  };
}

export type SectionReach = Array<{ section: string; views: number }>;
export async function getHomepageSectionReach(start: Date, end: Date): Promise<SectionReach | null> {
  if (!isPosthogConfigured()) return null;
  const rows = await hogql(
    `SELECT properties.section AS section, count() AS views FROM events WHERE event = 'mkt_section_viewed' AND timestamp >= toDateTime('${fmt(start)}') AND timestamp < toDateTime('${fmt(end)}') GROUP BY section ORDER BY views DESC`,
  );
  if (rows == null) return null;
  return rows.map((r) => ({ section: str(r[0]), views: num(r[1]) }));
}

export type CtaClicks = Array<{ cta: string; clicks: number }>;
export async function getCtaClicks(start: Date, end: Date): Promise<CtaClicks | null> {
  if (!isPosthogConfigured()) return null;
  const rows = await hogql(
    `SELECT properties.cta_location AS cta, count() AS clicks FROM events WHERE event = 'mkt_cta_clicked' AND timestamp >= toDateTime('${fmt(start)}') AND timestamp < toDateTime('${fmt(end)}') GROUP BY cta ORDER BY clicks DESC LIMIT 20`,
  );
  if (rows == null) return null;
  return rows.map((r) => ({ cta: str(r[0]), clicks: num(r[1]) }));
}
