# components/agent/progressor-network

Agent-app UI for the **Progressor Network** — the founder-gated marketplace where an
agency discovers and connects with independent sales-progression businesses.
Rendered by `app/agent/progressor-network/page.tsx` (founder-gated via
`lib/security/founder.ts`), fed by the typed mock service in
`lib/services/progressor-network.ts`.

Why these live in a domain folder (not `components/ui`, per Law 14): each composes
canonical primitives (`Button`, `Pill`, `GlassTabs`, `SearchField`, `Popover`,
`Drawer`) into marketplace-specific layouts that only make sense for this surface.

| Component | What it is |
|---|---|
| `ProgressorNetwork.tsx` | Client orchestrator: tabs, search, filters, sort, the card grid, the profile drawer. State lives here. |
| `ProgressorCard.tsx` | One business card (brand tile, availability, four stats, specialism chips, view/connect/save actions). |
| `NetworkValueStrip.tsx` | The three-benefit strip under the page hero. |
| `HowItWorksRail.tsx` | The three-step "Discover → Connect → Assign sales" rail beside the Discover grid. |
| `ProgressorProfileDrawer.tsx` | "View profile" drawer: fuller detail + connect CTA. |
| `shared.ts` | Small shared helpers (tag→icon, readable-on-brand text colour, stat formatting). |

**Status: P0** — visual + interaction prototype against the mock service. Save and
connect are optimistic in-session edits; real profiles/stats land in P1 and the
connect handshake + network-provenance attribution in P2. See
`docs/active/progressor-network/SPEC.md`.
