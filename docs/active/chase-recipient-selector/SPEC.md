# Chase recipient selector — SPEC

Status: in build (2026-09-03)
Owner: Ellis
Origin: agent request (WhatsApp) — "on these Chase things it sends to the vendors, how can I
change so I can send to the solicitors instead? Be good if there is a drop down and you can
select where to send to ie solicitor etc but auto generates as per the chase required ie draft
contracts."

Law 1 sources of truth quoted:
- Recipient side is milestone-driven — `app/api/ai/generate-chase/route.ts:188` (`anchorMilestone.side`),
  and code-prefix VM*/PM* → vendor/purchaser in `lib/services/comms.ts`.
- Solicitor identity + side is stored on `PropertyTransaction` FK columns
  `vendorSolicitorContactId` / `purchaserSolicitorContactId` → `SolicitorContact`
  (`prisma/schema.prisma:385-388`, model at `:961-982`). NOT on `Contact`.

---

## Problem

The chase drawer always addresses the **client on the chased milestone's side** (vendor, or
buyer/broker). The solicitor is only ever an email **CC**, and the agent has no way to send a
chase (e.g. "draft contracts") **to** the solicitor as the primary recipient.

Two facts that shape the build:

1. **Solicitors are not in `Contact`.** The new-sale flow only ever writes `roleType` `vendor` /
   `purchaser` contacts (`app/actions/transactions.ts:1542-1548`). Real solicitors live in
   `SolicitorFirm` / `SolicitorContact`, wired via the four side-tagged FK columns on
   `PropertyTransaction`. So today's drawer line
   `contacts.find(c => c.roleType === "solicitor")` is **effectively dead on real files** — the
   existing "CC the solicitor" toggle has nothing to CC. This feature also fixes that latent bug
   by pointing the drawer at the real `SolicitorContact` FK data.

2. **Side is unambiguous.** Which column the solicitor sits in *is* the side. No inference needed.

## Decisions (locked with founder 2026-09-03)

| # | Decision | Choice |
|---|---|---|
| 1 | Recipient scope | **Same side only.** Vendor-side chase → vendor(s) + vendor's solicitor. Buyer-side chase → buyer(s) + broker + buyer's solicitor. Never cross-side. |
| 2 | CC when solicitor is the recipient | **No client CC.** Clean solicitor-only send. (Solicitor's own `secondaryEmail` assistant address is still auto-CC'd — matches every other solicitor send on the platform.) |
| 3 | Solicitor channel | **Email only.** Picking a solicitor forces Email; WhatsApp toggle disabled with a one-line note. Preserves the existing "never solicitor on WhatsApp" rule. |

Default recipient is unchanged (the milestone-side client), so nothing changes for the agent
unless they open the new dropdown.

---

## Design

### Recipient model (shared, client-safe)

New pure module `lib/services/chase-recipients.ts`. No server-only imports — used by both the
drawer (client) and the generate route (server).

```ts
type ChaseSide = "vendor" | "purchaser";

interface ChaseContact {          // superset of the drawer's Contact shape
  id: string;
  name: string;
  roleType: string;               // vendor | purchaser | broker | solicitor
  email?: string | null;
  phone?: string | null;
  side?: ChaseSide | null;        // set on solicitor entries; drives the label
  secondaryEmail?: string | null; // solicitor assistant CC
  firmName?: string | null;       // solicitor firm, for the dropdown label
}

interface SolicitorRef {
  id: string; name: string;
  email?: string | null; phone?: string | null; secondaryEmail?: string | null;
  firm?: { name: string } | null;
}

// Inject the correct-side solicitor(s) into an already side-scoped contact list.
// side given  -> only that side's solicitor.
// side null   -> include both present (chase-all across mixed sides).
withSolicitorRecipients(contacts, { vendorSolicitor, purchaserSolicitor, side }): ChaseContact[]

// Human label for a recipient row.
recipientLabel(c: ChaseContact): string   // "Jane Smith · Vendor" / "A. Cole · Vendor's solicitor (Foo LLP)"
```

Solicitor entries are injected as `roleType: "solicitor"` with `side`, `secondaryEmail`,
`firmName` populated, and `id = SolicitorContact.id`.

### Drawer (`components/chase/ChaseDrawer.tsx`)

- Extend the local `Contact` interface with `side?`, `secondaryEmail?`, `firmName?`.
- Replace the hidden auto-picked recipient with an explicit **"To" selector**:
  - Candidates = `contacts` with an email or phone (already side-scoped by the caller, solicitor
    injected).
  - Default selection = first client with email → else first solicitor with email → else first
    with any address. **Identical to today's `clientContact ?? solicitorContact ?? …`**, so the
    default send target does not change.
  - One candidate → static "To: {name}" line. Two+ → a dropdown (reuses the existing themed
    dropdown pattern already in this file for Tone).
- **Channel rule:** solicitor selected → force `email`, disable the WhatsApp tab with note
  "Solicitors are emailed". Client selected → both channels as today (WhatsApp needs a phone).
- **CC rule:** solicitor selected → no CC toggle; auto-CC the solicitor's `secondaryEmail` if
  present. Client selected → keep the "CC {solicitor}" toggle, now pointed at the real same-side
  `SolicitorContact` (this is the latent-bug fix).
- The separate WhatsApp contact picker is folded into the unified "To" selector.
- Send + footer summary + generate all read `selectedRecipient` instead of the inferred one.

### Generation (`app/api/ai/generate-chase/route.ts`)

- Add `vendorSolicitorContact` / `purchaserSolicitorContact` (+ firm) to the tx include.
- Accept `recipientId` + `recipientRole` in the body.
  - `recipientRole === "solicitor"` → primary recipient = the milestone-side `SolicitorContact`
    (first name + "vendor's/purchaser's solicitor" role). No CC line.
  - else → primary recipient = the `Contact` matching `recipientId` (validated against the tx).
    CC line uses the side's real solicitor when `includeSolicitorCc`.
  - No `recipientId` → current inference (back-compat; nothing else calls this route).
- Milestone still supplies the chase **purpose**; the picked recipient supplies **addressee +
  role wording**. PII-minimisation rules unchanged (role labels + counts, no other-party names).

### Send + logging

- Email: `send-email` already takes `toEmail` / `toName` / `ccEmails`; drawer just passes the
  selected recipient's address + the resolved CC list. `deriveChaseTargetSide(chaseTaskId)`
  already stamps the correct side on the mirror row.
- `/api/comms` log row: content already includes the message; pass the recipient's display label
  so the timeline reads truthfully. `contactIds` continues to hold `Contact.id`s only — solicitor
  recipients (a different id space) are represented in the human `content` string, never shoved
  into `contactIds` (see the explicit warning at `lib/services/comms.ts:708-724`).

### Consumer wiring (two live surfaces)

1. **File detail — Reminders tab.** `vendorSolicitorContact` / `purchaserSolicitorContact` are
   already loaded on the file page (already passed to `ActivityPanel`, page `:635-636`). Thread
   them page → `RemindersPanel` → `RemindersSection`, and inject the side solicitor in
   `contactsForSide()` / the chase-all + early-chase paths.
2. **Work queue.** `getAgentReminderLogs` (`lib/services/reminders.ts`) must add the two solicitor
   FK contacts to its `transaction.select`; `AgentRemindersList`'s `SideColumn` injects the side
   solicitor before rendering the drawer.

`ReminderCard` / `TaskCard` chase entry points are dead code (never reach a live ChaseButton) —
left untouched beyond type compatibility.

---

## Build order

- **PR1** — `lib/services/chase-recipients.ts` (types + `withSolicitorRecipients` + `recipientLabel`).
- **PR2** — drawer "To" selector + channel/CC rules (default behaviour unchanged when no
  solicitor data is passed).
- **PR3** — recipient-aware generation.
- **PR4** — send/comms recipient plumbing + wire both live consumers.

Each is one concern (Law 5). No migration required — all data already exists.

## Voice (Law 21)

New strings: "To", "Solicitors are emailed", "Vendor's solicitor", "Buyer's solicitor",
"Add a solicitor to send to them". No em-dashes, no "delete", no titles, buyer-facing wording
uses "Buyer" not "Purchaser".
</content>
</invoke>
