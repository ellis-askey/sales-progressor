// Pure metric vocabulary for Growth tests — no server imports, so client
// components can use the labels. The live computation lives in
// experiment-metrics.ts (which pulls in Prisma).

export type MetricKey =
  | "signups"
  | "uniqueActiveUsersAvg"
  | "transactionsCreated"
  | "milestonesConfirmed"
  | "chasesSent"
  | "aiDraftsGenerated"
  | "aiSpendCents"
  | "followupTaps"
  | "quoteRequests"
  | "pushOptins"
  | "portalMessages"
  | "clientConfirms"
  | "portalDocsUploaded";

export type MetricDef = {
  key: MetricKey;
  label: string; // short human label
  plain: string; // plain-English description for tips
  higherIsBetter: boolean; // direction that counts as a win
};

export const METRIC_DEFS: Record<MetricKey, MetricDef> = {
  signups:              { key: "signups",              label: "New sign-ups",           plain: "agencies that joined",                           higherIsBetter: true },
  uniqueActiveUsersAvg: { key: "uniqueActiveUsersAvg", label: "Active users (avg/day)", plain: "people using it on an average day",              higherIsBetter: true },
  transactionsCreated:  { key: "transactionsCreated",  label: "Sales started",          plain: "new sale files created",                         higherIsBetter: true },
  milestonesConfirmed:  { key: "milestonesConfirmed",  label: "Milestones confirmed",   plain: "steps confirmed across all files",               higherIsBetter: true },
  chasesSent:           { key: "chasesSent",           label: "Chases sent",            plain: "chase emails sent",                              higherIsBetter: true },
  aiDraftsGenerated:    { key: "aiDraftsGenerated",    label: "AI drafts",              plain: "AI messages drafted",                            higherIsBetter: true },
  aiSpendCents:         { key: "aiSpendCents",         label: "AI spend",               plain: "AI cost in the window",                          higherIsBetter: false },
  followupTaps:         { key: "followupTaps",         label: "Conveyancer nudges",     plain: "clients tapping 'email your conveyancer'",       higherIsBetter: true },
  quoteRequests:        { key: "quoteRequests",        label: "Quote requests",         plain: "survey/broker quotes requested from the portal", higherIsBetter: true },
  pushOptins:           { key: "pushOptins",           label: "Notification opt-ins",   plain: "clients turning on portal notifications",        higherIsBetter: true },
  portalMessages:       { key: "portalMessages",       label: "Portal messages",        plain: "messages clients sent their agent",              higherIsBetter: true },
  clientConfirms:       { key: "clientConfirms",       label: "Client confirms",        plain: "steps clients confirmed themselves",             higherIsBetter: true },
  portalDocsUploaded:   { key: "portalDocsUploaded",   label: "Client uploads",         plain: "documents clients uploaded via the portal",      higherIsBetter: true },
};

export const METRIC_KEYS = Object.keys(METRIC_DEFS) as MetricKey[];

export function metricLabel(key: string): string {
  return (METRIC_DEFS as Record<string, MetricDef>)[key]?.label ?? key;
}
