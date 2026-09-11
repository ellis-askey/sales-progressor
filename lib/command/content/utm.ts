// UTM tagging (docs/active/content-brand/SPEC.md, Phase 6.2). So links Ellis
// shares in posts are attributable in the existing analytics. Pure, client-safe.

export type UtmOpts = { source?: string; medium?: string; campaign?: string };

export function withUtm(url: string, opts: UtmOpts): string {
  try {
    const u = new URL(url);
    if (opts.source) u.searchParams.set("utm_source", opts.source);
    if (opts.medium) u.searchParams.set("utm_medium", opts.medium);
    if (opts.campaign) u.searchParams.set("utm_campaign", slug(opts.campaign));
    return u.toString();
  } catch {
    return url;
  }
}

export function slug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
