// Command Centre — legacy Platform routes → the canonical tabbed workspace
// (/command/platform). Sibling of the content/growth/money/operations redirect
// modules; in lib/ (not lib/command/) so next.config.ts can import it. Pure data.
//
// Shadow-before-filesystem; permanent:false (302), reversible. Next forwards the
// request query (only Timeframes carries filters: segment/source/held/mode/
// agency — none collide with the canonical tab/view). Exact sources. Timeframes
// moves here FROM Growth as part of this consolidation.
//
// Page-local components stay with their (now page-less) dirs: emails/
// EmailCatalogue.tsx and email-senders/actions.ts are still imported by the
// workspace views.

export interface SimpleRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const PLATFORM_REDIRECTS: SimpleRedirect[] = [
  { source: "/command/emails", destination: "/command/platform?tab=emails&view=catalogue", permanent: false },
  { source: "/command/milestone-emails", destination: "/command/platform?tab=emails&view=milestones", permanent: false },
  { source: "/command/email-templates", destination: "/command/platform?tab=emails&view=templates", permanent: false },
  { source: "/command/milestone-updates", destination: "/command/platform?tab=updates", permanent: false },
  { source: "/command/solicitor-chase", destination: "/command/platform?tab=chasing", permanent: false },
  { source: "/command/rules", destination: "/command/platform?tab=engine&view=rules", permanent: false },
  { source: "/command/timeframes", destination: "/command/platform?tab=engine&view=timeframes", permanent: false },
];
