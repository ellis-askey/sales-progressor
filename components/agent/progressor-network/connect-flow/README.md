# components/agent/progressor-network/connect-flow

UI for the **Progressor Network connect flow** — an agency requests to connect with
a progression business; the business accepts or declines; once accepted they're
linked and the agency can hand it sales (both sides opt in).

These mirror the app's EXISTING progression handshake (`components/progression/`
ConnectionRequestCard / SentRequestsList / ClientsWorkspace), **reversed** so the
agency is the initiator instead of the business — same look, opposite direction.

Built presentational (props + callbacks) so the `/dev/connect-flow` preview can
drive them with mock state now, and the real request/accept actions wire in later.

| Component | What it is |
|---|---|
| `NetworkConnectModal.tsx` | The agency's "Request to connect" step (coral-band modal + optional note). |
| `IncomingRequestCard.tsx` | The progressor's incoming request, with Accept / Decline. |
| `ConnectFlowRows.tsx` | Small rows: agency's sent-request + connected-progressor rows; progressor's connected-agency (client) row. |

Status: **preview only** — composed by `app/dev/connect-flow/`. Not wired to the
real connection handshake yet (see docs/active/progressor-network/SPEC.md, P2).
