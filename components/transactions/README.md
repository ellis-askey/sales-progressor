# `components/transactions/` — All Files surface

Domain components for the All Files page (`/agent/transactions`), which is four
views in one (Pipeline / List / Forecast / Map). Most of it composes the
approved library (`StatCards`, `GlassCard`, `Popover`, `PropertyThumb`,
`UserAvatar`, `CountBadge`, arc `EmptyState`, the `agent-tab-bar-static` tabs,
the `agent-segment-pill` view switcher). The entries below are genuinely custom
pieces with no canonical equivalent — **registered as deliberate domain
primitives** (Law 14), **not force-migrated** (Law 19), at the 2026-11-23 pass.

| Primitive | Where | Why it's domain-specific, not a primitive |
|---|---|---|
| **Pipeline board** (`.pboard-*`, `PipelineBoard`) | Pipeline view | A horizontal per-stage board (columns, property cards, busiest ring). No canonical board exists. Its per-stage icon palette is a documented domain scale (all eight stages tokenised as of this pass). |
| **Forecast confidence chart** (`.fc-*`, `ForecastView`) | Forecast view | Bespoke line/area + two-segment proportion bars with a diagonal-hatch risk segment, a confidence band, and an overlaid target line — none expressible by `StackedBar`/`LegendItem`/`DeltaIndicator`. All strokes tokenised; the money "ahead/short" delta is a domain sibling of `DeltaIndicator`. |
| **Map view** (`.map-*`, `MapView` + `map/PropertyMap`) | Map view | A MapLibre GL map. Its WebGL paint (patch heat ramp, pin status colours, clusters) **cannot read CSS custom properties**, so those hex values are hardcoded by necessity — kept in sync with the DOM legend, which is tokenised. The "Street View peek" modal is a deliberate domain overlay. |
| **Table row** (`TransactionRowView`, `.files-*`) | List view | A dense table row with a hairline-divider layout (not a bordered card / `FeedRowShell`). No canonical table-row primitive exists. |
| **Filter toolbar controls** (`.fm-btn`, `.fm-cbx`, `FilterMenu`) | Chrome | The filter trigger + its draw-in-tick checkbox rows ride the canonical `Popover`; the button and the row checkbox are hand-tuned to sit level with the view-switcher pills. Registered rather than migrated to avoid the structural mismatch of nesting a standalone `Checkbox` inside a full-width row button. |

Still open after this pass (tracked, not done): the eyebrow typography sweep, and
the `StageBar` / `SearchTabsBar` / `ActiveFilterBanner` extractions.
Sign-off residuals: the 2026-11-23 All Files entry in `app/dev/components/_ds/registry.ts`.
