// Command Centre — legacy System routes → the canonical tabbed workspace
// (/command/system). Final sibling of the content/growth/money/operations/
// platform redirect modules; in lib/ (not lib/command/) so next.config.ts can
// import it. Pure data.
//
// Shadow-before-filesystem; permanent:false (302), reversible. Next forwards the
// request query (activity: mode/agency/who/sort; audit: action/target/admin/
// from/to/page — none collide with the canonical tab/view). Exact sources — the
// Settings → Connections detail route (/command/settings/connections) is NOT
// cascaded and stays.

export interface SimpleRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const SYSTEM_REDIRECTS: SimpleRedirect[] = [
  { source: "/command/health", destination: "/command/system?tab=monitoring&view=status", permanent: false },
  { source: "/command/activity", destination: "/command/system?tab=monitoring&view=activity", permanent: false },
  { source: "/command/audit", destination: "/command/system?tab=monitoring&view=audit", permanent: false },
  { source: "/command/updates", destination: "/command/system?tab=updates", permanent: false },
  { source: "/command/critique", destination: "/command/system?tab=critique", permanent: false },
  { source: "/command/settings", destination: "/command/system?tab=settings", permanent: false },
];
