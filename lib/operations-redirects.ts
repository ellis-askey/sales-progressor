// Command Centre — legacy Operations routes → the canonical tabbed workspace
// (/command/operations). Sibling of the content/growth/money redirect modules;
// in lib/ (not lib/command/) so next.config.ts can import it. Pure data.
//
// Shadow-before-filesystem mechanism; permanent:false (302), reversible. Next
// forwards the request query onto the destination. The retired routes carry only
// view-local params (files: q/tx/status/att/managed/created; outbound: filter
// params; agent-emails: mode/agency/rec/cursor + its legacy ?tab= kind) — none
// collide with the canonical tab/view EXCEPT agent-emails' legacy ?tab=, which
// the workspace shell neutralises by coercing a duplicated tab to its first
// value (always the destination's). Exact sources — they do NOT cascade to the
// Files ?tx= drawer (same route) or to any detail route.

export interface SimpleRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export const OPERATIONS_REDIRECTS: SimpleRedirect[] = [
  { source: "/command/files", destination: "/command/operations?tab=files", permanent: false },
  { source: "/command/outbound", destination: "/command/operations?tab=messaging&view=messages", permanent: false },
  { source: "/command/whatsapp", destination: "/command/operations?tab=messaging&view=whatsapp", permanent: false },
  { source: "/command/email-senders", destination: "/command/operations?tab=email&view=senders", permanent: false },
  { source: "/command/agent-emails", destination: "/command/operations?tab=email&view=agents", permanent: false },
  { source: "/command/email-threading", destination: "/command/operations?tab=email&view=threading", permanent: false },
  { source: "/command/proposals", destination: "/command/operations?tab=requests&view=proposals", permanent: false },
  { source: "/command/crm-requests", destination: "/command/operations?tab=requests&view=crm", permanent: false },
];
