# `components/hub/` — Agent Hub surface

Domain components for the Hub (`/agent/hub`), the agent's home dashboard. The
Hub is strongly canonical — most cards compose shared primitives (`GlassCard`,
`StatBlock`, `StatCards`, `PanelHeader`, `Pill`, `PropertyThumb`, arc `Button`,
`AnchoredPanel`, the `HeatBand`/`Donut`/`Sparkline` chart wrappers, the shared
`HubCard`/`HubRow` shell+row). The entries below are the genuinely custom pieces
that have **no canonical equivalent** and are **deliberately kept bespoke**
(Law 14 register, Law 19 don't-force-migrate), registered at the 2026-11-23
sign-off.

## Registered domain primitives (deliberately bespoke)

| Primitive | Where | Why it's domain-specific, not a primitive |
|---|---|---|
| **Pipeline stage strip** (`.pipe-*`, `PipelineAtAGlance`) | Bottom of the hub | A responsive card strip showing the whole offer→completion pipeline (reached / up-next / ghost states, container-query reflow, light+dark). Not a `StackedBar`/`StepDots`/`ProgressBar`. Its six **per-stage accent colours** are a named domain scale (justIn/moving/legal/nearly/exchanged/completed) with no app token — kept as documented domain hexes. |
| **Diary row** (`.diary-row`, `DiaryEventRow`) | Diary card | A coloured, accent-bordered row. It **deliberately keeps a semantic coloured background** (coral for events, green for completions) — the one place in the app that keeps a wash fill rather than de-tinting to a border (founder-confirmed, 2026-11-23). Not `FeedRowShell`/`ActivityRow`. |
| **Attention row** (`.attn-row`, `AttentionCard`) | Needs-your-attention card | A CSS-grid reminder row with container-query reflow + a left urgency accent bar. More than `FeedRowShell` models; migrating risks behavioural change (Law 19). |
| **Resume-hold modal** (`AttentionCard`) | Resume a paused hold | A bespoke 2-path chooser popup, ported verbatim from the old ExpiredHoldsCard. Grandfathered; a canonical-modal rebuild is deferred to the modal/drawer pass. |

## Grandfathered (works; migration deferred, Law 19)

- `BookingsToConfirmCard` hand-rolls its card shell + rows instead of the shared `HubCard`/`HubRow`. Byte-identical output; left as-is at founder request (no visual gain, avoid the risk).

Sign-off residuals + rationale: see the 2026-11-23 Hub sign-off entry in
`app/dev/components/_ds/registry.ts`.
