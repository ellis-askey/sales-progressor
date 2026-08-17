// Display taxonomy for the Command Centre agent-emails surface. Pure + client-
// safe (no prisma) so the page, the API filter, and the row component all share
// one source of truth for kind labels and tab grouping. The send-side union
// lives in lib/email/agent-log.ts; keep the two in step when a sender is added.

export const AGENT_EMAIL_KINDS = [
  "weekly_brief",
  "morning_digest",
  "retention",
  "welcome",
  "claim_welcome",
  "team_invite",
  "team_accepted",
  "portal_message",
  "domain_auth",
  "verified_email",
  "chain_invite",
  "password_reset",
] as const;

export type AgentEmailKind = (typeof AGENT_EMAIL_KINDS)[number];

export const KIND_LABELS: Record<AgentEmailKind, string> = {
  weekly_brief: "Weekly brief",
  morning_digest: "Morning digest",
  retention: "Retention",
  welcome: "Welcome",
  claim_welcome: "Claim welcome",
  team_invite: "Team invite",
  team_accepted: "Team accepted",
  portal_message: "Portal message",
  domain_auth: "Domain auth",
  verified_email: "Verified email",
  chain_invite: "Chain invite",
  password_reset: "Password reset",
};

export function kindLabel(kind: string): string {
  return (KIND_LABELS as Record<string, string>)[kind] ?? kind;
}

// Redacted kinds store no body (a live secret link). The detail view shows a
// "body not stored" note instead of a preview.
export const REDACTED_KINDS: ReadonlySet<string> = new Set<string>(["password_reset"]);

export type AgentEmailTabId =
  | "all"
  | "briefs"
  | "onboarding"
  | "alerts"
  | "portal"
  | "chain"
  | "auth";

export const TABS: { id: AgentEmailTabId; label: string; kinds: AgentEmailKind[] }[] = [
  { id: "all", label: "All", kinds: [...AGENT_EMAIL_KINDS] },
  { id: "briefs", label: "Briefs & digests", kinds: ["weekly_brief", "morning_digest"] },
  {
    id: "onboarding",
    label: "Onboarding & team",
    kinds: ["welcome", "claim_welcome", "retention", "team_invite", "team_accepted"],
  },
  { id: "alerts", label: "Alerts", kinds: ["domain_auth", "verified_email"] },
  { id: "portal", label: "Portal messages", kinds: ["portal_message"] },
  { id: "chain", label: "Chain invites", kinds: ["chain_invite"] },
  { id: "auth", label: "Auth", kinds: ["password_reset"] },
];

// The kinds a tab filters to, or null for "all" (no kind filter).
export function kindsForTab(tabId: string): AgentEmailKind[] | null {
  if (tabId === "all") return null;
  const tab = TABS.find((t) => t.id === tabId);
  return tab ? tab.kinds : null;
}

// Which tab-group a kind belongs to (for pill colour).
export function groupForKind(kind: string): AgentEmailTabId {
  for (const tab of TABS) {
    if (tab.id === "all") continue;
    if ((tab.kinds as string[]).includes(kind)) return tab.id;
  }
  return "all";
}

// Muted, utilitarian pill tones — one per group. Kept within the CC palette
// (blue accent + neutrals, no glass).
export const GROUP_PILL: Record<AgentEmailTabId, string> = {
  all: "bg-neutral-800 text-neutral-300",
  briefs: "bg-[#1d2d50] text-[#93c5fd]",
  onboarding: "bg-[#14352a] text-[#6ee7b7]",
  alerts: "bg-[#3a2a12] text-[#fbbf24]",
  portal: "bg-[#3a1d2e] text-[#f9a8d4]",
  chain: "bg-[#2a2350] text-[#c4b5fd]",
  auth: "bg-[#3a1717] text-[#fca5a5]",
};
