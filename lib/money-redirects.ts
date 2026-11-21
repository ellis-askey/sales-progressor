// Command Centre — legacy Money routes → the canonical tabbed workspace
// (/command/money). Sibling of lib/content-redirects.ts + lib/growth-redirects.ts;
// in lib/ (not lib/command/) so next.config.ts can import it without the
// `no-command-import-outside` lint rule. Pure data.
//
// Same shadow-before-filesystem mechanism: config redirects run before the
// filesystem, so these shadow the (still-present until retirement) legacy pages.
// permanent:false (302) — reversible. Next forwards the request query onto the
// destination; the legacy routes carry only view-local params (revenue:
// mode/agency; quotes: status/firmId/collected) — none collide with the
// canonical tab.
//
// Exact-match sources only: they do NOT cascade to the detail/config/breakdown
// routes, which stay — /command/revenue/[agencyId], /command/revenue/breakdown,
// /command/providers/[id], /command/providers/quotes/[id],
// /command/providers/service-types.

export interface SimpleRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const MONEY_REDIRECTS: SimpleRedirect[] = [
  { source: "/command/revenue", destination: "/command/money?tab=revenue", permanent: false },
  { source: "/command/providers/quotes", destination: "/command/money?tab=quotes", permanent: false },
  { source: "/command/providers", destination: "/command/money?tab=firms", permanent: false },
];
