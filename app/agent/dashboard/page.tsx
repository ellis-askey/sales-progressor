// /agent/dashboard — absorbed into /agent/transactions during the 2026-05-12
// merge (see commit message + docs/polish-pass/PAGE_LIST.md position 6 note).
//
// 307 redirect preserves query params, so any deep-linked bookmarks like
// /agent/dashboard?filter=on_hold survive: they land on
// /agent/transactions?filter=on_hold which renders the same status-filtered
// list (status-tab values overlap exactly).
//
// AgentRequestsPanel, AgentFlagButton moved to /agent/transactions per the
// merge plan. AgentRequestsPanel render is suspended pending /agent/to-do
// redesign; component file preserved at components/agent/AgentRequestsPanel.tsx
// for that future wire-in. (The old ForecastStrip / PostExchangeStrip were
// orphaned by the merge and removed 2026-11-23.)

import { redirect } from "next/navigation";

export default async function DashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const target = filter
    ? `/agent/transactions?filter=${encodeURIComponent(filter)}`
    : "/agent/transactions";
  redirect(target);
}
