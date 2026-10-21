# components/automated-emails

Domain components for the `/agent/automated-emails` operational dashboard. These
are specific to the automated-communication surface and its two data sources
(`OutboundEmailQueue` + solicitor sends in `OutboundMessage`), so they live here
rather than in `components/ui/`.

| File | What it is | Why domain-specific, not a primitive |
|---|---|---|
| `deliveryStatus.ts` | Maps an email delivery status (`delivered`/`deferred`/`bounced`/`blocked`/`errored`/`pending`/`sent`/`failed`) to a canonical `Pill` tone + label. | The status vocabulary is specific to this feature's email pipeline; the underlying badge is the shared `ui/Pill`. |
| `AutomationBanner.tsx` | At-a-glance health strip that leads the page: paused / needs-attention / healthy status + sent-today / queued / needs-attention / files-monitored figures. | Composes the feature's `AutomationBanner` overview shape; the health taxonomy is feature-specific. |
| `AutoRefresh.tsx` | "Updated HH:MM · refreshes itself" line — re-pulls the page every two minutes while visible. | Refresh cadence + copy are tied to this page's freshness promise. |
| `EmailFeedRow.tsx` | The ONE feed row + category chip + day-grouping helpers shared by Outbox / History / Problems. Predicted rows wear a dashed accent + "Predicted". | Renders the feature's `EmailRow`; the row anatomy is feature-specific, the badge inside is `ui/Pill`. |
| `OutboxView.tsx` | The landing schedule: sent today (with delivery state), still to go, then 14 days of queued + predicted sends day by day, closing with the "automation exhausted" list. Predictions open a true-to-send preview. | Merges `EmailRow[]` + `UpcomingForecast`; the schedule semantics are feature-specific. |
| `AutomationCoveragePanel.tsx` | Per-file coverage donut (covered / need-information / paused) + labelled legend. | Renders the feature's `AutomationCoverage` rollup; the file-health buckets are feature-specific. |
| `FilesView.tsx` | Files tab: one row per active file (coverage status, queued count + next send, issue count), attention-first. The coverage donut expanded into a working list. | Renders the feature's `FileAutomationRow[]`; per-file automation state is feature-specific. |
| `SendingTodayPanel.tsx` | Short list of queued sends due today with inline Send now / Skip, calling the race-safe feature server actions. A focused intercept surface (the Pending tab is the full list). | Composes the feature's `SendingTodayRow` + its send/cancel actions; the intercept UX is feature-specific. |
| `ChasePerformanceView.tsx` | Chase performance tab: response + resolution rates, avg chases to resolve, and an outcome bar (still chasing / resolved / needed a person / closed). Client chases only. | Renders the feature's `ChasePerformance` analytics; the chase-outcome vocabulary is feature-specific. |
| `EmailHealthView.tsx` | Email health tab: delivery + bounce/block rates and a where-every-send-ended-up bar (delivered / awaiting / deferred / bounced / blocked). Queue only. | Renders the feature's `EmailHealth` deliverability analytics; the honesty rules (awaiting ≠ delivered) are feature-specific. |
| `EmailActivityChart.tsx` | Compact per-day **stacked** bar chart (chase vs notification) built on recharts. | First stacked chart in the repo. Data shape (`DayBucket`) is feature-specific. If a second stacked chart appears, promote a generic `StackedBarChart` to `components/analytics/`. |
| `AutomationActivityPanel.tsx` | The "Automation activity" overview: KPI tiles + period control + the chart. | Composes feature KPIs (`AutomationOverview`) — not reusable outside this page. |
| `NeedsAttentionPanel.tsx` | Actionable delivery-problem list (bounced/blocked/deferred/failed) with safe link-only actions. | Reads `NeedsAttention` from the feature service; problem taxonomy is feature-specific. |
| `EmailDetailDrawer.tsx` | Right-side detail drawer (composes `ui/Drawer`): preview/edit a queued email, "why is this being sent", automation context, and the race-safe Cancel / Send-now controls. Predicted rows compose their email live via `previewChaseEmailAction`, so the preview is true to the send. | Ports the old `EmailPreviewModal` flow onto the canonical drawer; loads/acts via feature server actions. |

Canonical primitives reused (imported, not re-created): `ui/Pill`, `ui/RoleIcon`,
`glass/GlassCard`, recharts, and the `.agent-*` CSS classes in
`app/agent/styles/agent-system.css`.
