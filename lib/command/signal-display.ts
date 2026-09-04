// Human layer for signals. Turns a raw (detectorName, payload) into a plain-
// English title, a "what this means" explanation, a deep link to the thing it's
// about, and whether an experiment makes sense for it.
//
// Server-safe (no client imports) so the Briefing page can render it directly.

type Payload = Record<string, unknown>;

const str = (p: Payload, k: string): string => (p[k] == null ? "" : String(p[k]));
const num = (p: Payload, k: string): number => (typeof p[k] === "number" ? (p[k] as number) : Number(p[k]) || 0);

export type SignalDisplay = {
  /** Group heading for the feed. */
  group: string;
  /** One-line "what this means", shown in a hover tip. */
  whatItMeans: string;
  /** Does turning this into an A/B experiment make sense? */
  experimentable: boolean;
  /** Plain-English one-liner for a single signal. */
  title: (p: Payload) => string;
  /** Deep link to act on it, or null. */
  href: (p: Payload) => string | null;
};

const filesHref = (p: Payload): string | null => {
  const tx = str(p, "transactionId");
  return tx ? `/command/files?tx=${tx}` : null;
};

const GENERIC: SignalDisplay = {
  group: "Other",
  whatItMeans: "A pattern a detector flagged. Open the details to see the numbers behind it.",
  experimentable: true,
  title: (p) => {
    const label = str(p, "label") || str(p, "indicator") || str(p, "summary");
    return label || "Pattern detected";
  },
  href: () => null,
};

export const SIGNAL_DISPLAY: Record<string, SignalDisplay> = {
  metric_delta: {
    group: "Metric moved",
    whatItMeans: "A platform-wide number moved more than 10% week-on-week. Direction and size are in the title.",
    experimentable: true,
    title: (p) => {
      const label = str(p, "label") || "a metric";
      const d = num(p, "deltaPercent");
      const dir = d >= 0 ? "up" : "down";
      return `${label} ${dir} ${Math.abs(d)}% (${num(p, "current")} vs ${num(p, "previous")})`;
    },
    href: () => "/command/overview",
  },
  silent_agency: {
    group: "Silent agency",
    whatItMeans: "An agency that was active once but hasn't done anything on the platform for 14+ days, whether or not they still have a live file. They may be drifting away.",
    experimentable: false,
    title: (p) => `${str(p, "agencyName") || "An agency"} silent ${num(p, "daysSilent")} days`,
    href: () => "/command/agencies",
  },
  revenue_at_risk: {
    group: "Revenue at risk",
    whatItMeans: "Money-adjacent: a file that exchanged with no fee recorded (can't invoice), or one ready to exchange but stalled.",
    experimentable: false,
    title: (p) =>
      str(p, "kind") === "unbilled_exchange"
        ? `${str(p, "address")}: exchanged ${num(p, "exchangedDaysAgo")}d ago, no fee recorded`
        : `${str(p, "address")}: ready to exchange, stalled ${num(p, "daysStalled")}d`,
    href: filesHref,
  },
  portal_gone_quiet: {
    group: "Client gone quiet",
    whatItMeans: "A buyer or seller who used the portal, then stopped opening it for 14+ days on a live file.",
    experimentable: false,
    title: (p) => `${str(p, "clientName")} (${str(p, "role")}) quiet ${num(p, "daysQuiet")}d · ${str(p, "address")}`,
    href: filesHref,
  },
  chase_not_landing: {
    group: "Chases not landing",
    whatItMeans: "Chases went out on a live file but nothing came back (no reply via link or email) after 7+ days.",
    experimentable: false,
    title: (p) => `${str(p, "address")}: ${num(p, "unansweredChases")} chases unanswered (${num(p, "daysSinceLastChase")}d)`,
    href: filesHref,
  },
  quote_inbox_aging: {
    group: "Quote inbox aging",
    whatItMeans: "Quote requests sitting as 'pending' in the inbox past 5 days without being actioned.",
    experimentable: false,
    title: (p) => `${num(p, "pendingCount")} quotes pending, oldest ${num(p, "oldestDaysWaiting")}d`,
    href: () => "/command/providers/quotes",
  },
  solicitor_confirm_pending: {
    group: "Solicitor confirmation stuck",
    whatItMeans: "A solicitor confirmation we've chased to the cap with no response. The step is genuinely stuck.",
    experimentable: false,
    title: (p) => `${str(p, "address")}: ${str(p, "step")} (${str(p, "side")}), chased ${num(p, "chaseCount")}x`,
    href: filesHref,
  },
  funnel_drop: {
    group: "Funnel drop",
    whatItMeans: "A step in a user journey is converting worse than before.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "step") || "Funnel step converting worse",
    href: () => null,
  },
  cohort_pattern: {
    group: "Cohort pattern",
    whatItMeans: "A group of agencies that signed up together is behaving differently from the norm.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "summary") || "Cohort behaving differently",
    href: () => null,
  },
  source_performance: {
    group: "Source performance",
    whatItMeans: "A signup or referral source is over- or under-performing.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "source") || "Source performance shift",
    href: () => null,
  },
  power_user_pattern: {
    group: "Power-user pattern",
    whatItMeans: "A standout heavy user whose behaviour might be worth learning from.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "summary") || "Power-user behaviour",
    href: () => null,
  },
  ai_quality_drift: {
    group: "AI quality drift",
    whatItMeans: "AI-generated content quality or acceptance is drifting.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "summary") || "AI quality drifting",
    href: () => null,
  },
  cost_drift: {
    group: "Cost drift",
    whatItMeans: "AI spend or event volume is trending toward a budget ceiling.",
    experimentable: false,
    title: (p) => str(p, "label") || str(p, "summary") || "Cost trending up",
    href: () => null,
  },
  content_performance: {
    group: "Content performance",
    whatItMeans: "Published content is performing notably better or worse than usual.",
    experimentable: true,
    title: (p) => str(p, "label") || str(p, "summary") || "Content performance shift",
    href: () => null,
  },
};

export function displayFor(detectorName: string): SignalDisplay {
  return SIGNAL_DISPLAY[detectorName] ?? { ...GENERIC, group: detectorName.replace(/_/g, " ") };
}
