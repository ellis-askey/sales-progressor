# components/automated-emails

Domain components for the `/agent/automated-emails` operational dashboard. These
are specific to the automated-communication surface and its two data sources
(`OutboundEmailQueue` + solicitor sends in `OutboundMessage`), so they live here
rather than in `components/ui/`.

| File | What it is | Why domain-specific, not a primitive |
|---|---|---|
| `deliveryStatus.ts` | Maps an email delivery status (`delivered`/`deferred`/`bounced`/`blocked`/`errored`/`pending`/`sent`/`failed`) to a canonical `Pill` tone + label. | The status vocabulary is specific to this feature's email pipeline; the underlying badge is the shared `ui/Pill`. |
| `AutomationBanner.tsx` | At-a-glance health strip that leads the page: running/paused status + queued / chasing-today / needs-attention / files-monitored figures. | Composes the feature's `AutomationBanner` overview shape; the health taxonomy is feature-specific. |
| `AutomationCoveragePanel.tsx` | Per-file coverage donut (covered / need-information / paused) + labelled legend. | Renders the feature's `AutomationCoverage` rollup; the file-health buckets are feature-specific. |
| `EmailActivityChart.tsx` | Compact per-day **stacked** bar chart (chase vs notification) built on recharts. | First stacked chart in the repo. Data shape (`DayBucket`) is feature-specific. If a second stacked chart appears, promote a generic `StackedBarChart` to `components/analytics/`. |
| `AutomationActivityPanel.tsx` | The "Automation activity" overview: KPI tiles + period control + the chart. | Composes feature KPIs (`AutomationOverview`) — not reusable outside this page. |
| `NeedsAttentionPanel.tsx` | Actionable delivery-problem list (bounced/blocked/deferred/failed) with safe link-only actions. | Reads `NeedsAttention` from the feature service; problem taxonomy is feature-specific. |
| `EmailDetailDrawer.tsx` | Right-side detail drawer (composes `ui/Drawer`): preview/edit a queued email, "why is this being sent", automation context, recent activity, and the race-safe Cancel / Send-now controls. | Ports the old `EmailPreviewModal` flow onto the canonical drawer; loads/acts via feature server actions. |
| `UpcomingView.tsx` | Upcoming tab: predicted client + solicitor chases grouped by day, plus the "automation exhausted" attention list. Styled distinctly (muted, dashed, "Predicted") so predictions never read as queued records. | Renders `UpcomingForecast` from the feature service; prediction taxonomy is feature-specific. |

Canonical primitives reused (imported, not re-created): `ui/Pill`, `ui/RoleIcon`,
`glass/GlassCard`, recharts, and the `.agent-*` CSS classes in
`app/agent/styles/agent-system.css`.
