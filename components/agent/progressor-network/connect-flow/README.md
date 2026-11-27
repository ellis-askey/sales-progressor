# components/agent/progressor-network/connect-flow

Premium UI for the **Progressor Network connect journey** — an agency discovers a
progression business, requests a connection, the business accepts/declines, and
once connected it becomes a working-relationship card (both sides opt in).

Built from canonical components (Phosphor icons, `Modal`, `GlassTabs`,
`SegmentedSwitch`, `StatNumber`, `Button`, `AgencyMeshMark`, `ContactAvatar`,
`agent-glass` surfaces, agent toasts, `EmptyState`). Presentational — props +
callbacks — so the `/dev/connect-flow` preview drives them with fictional mock
state and the real request/accept actions wire in later.

| Component | What it is |
|---|---|
| `PremiumBusinessCard.tsx` | Marketplace card — identity, quiet availability, headline metrics, supporting line, adaptive actions. |
| `BusinessProfile.tsx` | The business storefront — brand header band + Overview / Performance / Team tabs. |
| `NetworkConnectModal.tsx` | "Request a connection" — dual identity, optional introduction, privacy copy. |
| `IncomingRequestCard.tsx` | The progressor's incoming request, with context + accept/decline. |
| `ConnectFlowRows.tsx` | Connected relationship cards (agency + progressor) and the pending-request row. |
| `fixtures.ts` | Clearly fictional preview data. |

Status: **preview only** — composed by `app/dev/connect-flow/`, founder-gated.
Nothing here touches the production marketplace, logic, permissions or schema;
production migration is a separate, approved step. See
docs/active/progressor-network/SPEC.md (P2).
