# LabelInput rollout — canonical single-line field

Making `components/ui/LabelInput` (Bencho, ported) the canonical single-line
text / email / tel / password field: the label lives *in* the field and lifts
on focus, so the eyebrow header above each input goes away.

Status date: 2026-11-18. Not committed / not pushed — working tree only.

## Sizes

`LabelInput` now takes a `size` prop so the treatment can keep the original
footprint instead of growing fields:

- `size="md"` (default) — 48px tall. The roomy auth field (login, register). Unchanged.
- `size="sm"` — 40px tall, no top gap. Changes **only the height** — corner (20px) and font (16px) stay the md values so the field keeps its established look, just shorter.

Explicit `height` / `fontSize` / `corner` / `topGap` props still override the preset. Geometry is driven by CSS vars (`--lbi-lift`, `--lbi-fs`) so any height scales correctly.

## Property file — done (size="sm", coral accent)

| Row | Where | File |
|-----|-------|------|
| 1 | Overview › Contacts › add-contact (Full name / Email / Phone / Contact person) | `components/contacts/ContactsSection.tsx` |
| 2 | Overview › Contacts › inline edit-contact | same |
| 5 | Chase drawer › add solicitor (Firm / Handler / Email / Direct line / Assistant email) | `components/chase/ChaseDrawer.tsx` |
| 6 | Chase drawer › add contact (Name / Email / Phone) | same |

All logic preserved: controlled value, `onBlur` normalisation (title-case / lowercase email / phone format), `required`, autofocus (now via `autoFocus`). Example placeholders ("name@example.com" etc.) are gone by design (approved) — the floating label occupies that slot.

**Role field** → replaced the native `<select>` with the uiarc `DropdownMenu`
(`components/arc/dropdown-menu/`), `fullWidth` and 40px to line up with the
fields. The external "Role" eyebrow was dropped so it aligns with the
floating-label fields; the trigger shows the current role as its value.

Two integration fixes were required and are worth remembering:
- **Tokens:** the menu needs the arc tokens, fed via a **scoped** file
  (`components/arc/dropdown-menu/scope.css`) — NOT `foundation.css`, which
  carries app-wide global focus resets (`outline:none !important` on every
  input) and must never be imported into production.
- **Portal:** Radix portals the menu to `<body>`, outside any `.arc-scope`
  wrapper, so the menu rendered as giant unstyled text. Fixed by putting the
  `arc-scope` class on the portaled `Content` itself (in the vendored
  `dropdown-menu.tsx`) so the tokens reach it.

### Cleanup owed on commit
Inert leftovers (harmless, `noUnusedLocals` off): `INPUT` + `SELECT` consts in ContactsSection, `addInputStyle` in ChaseDrawer.

## Parked — go back to these (need instruction)

These are NOT clean drop-ins; each needs a decision before building.

| Row | Where | Blocker |
|-----|-------|---------|
| 3 | Client-portal drawer (`components/portal/PortalEditDrawer.tsx`) | Agency-themed (`P.pageBg`/`P.border`/`P.textPrimary` — some portals are dark; LabelInput ink isn't portal-tokened) **and** inline per-field errors. |
| 4 | Chain add-neighbour (`components/chain/AddNodeDrawer.tsx`) | Name fields are `GhostField` (inline typeahead ghost-completion); email carries a focus-ref + inline `emailError`. |
| 7 | Setup › add solicitor / conveyancer / broker (`components/transactions-v2/form/SolicitorSection.tsx`, `components/brokers/BrokerField.tsx`) | `FieldIndicator` source badges live inside the label. |
| 8 | Setup › main editable file form (`AddressFields.tsx`, `Stage1Fields.tsx`, `form/ContactsSection.tsx`) | Each label hosts `FieldIndicator` + `FieldHint` (source + validation). |

### Decisions needed (apply across 3, 4, 7, 8)
1. **Inline errors** — keep them by rendering the error as a line *below* LabelInput? (Feasible — the error is a separate element.)
2. **Source / validity indicators (7, 8)** — (a) drop, (b) move to a right-edge adornment, or (c) leave those forms on the current input.
3. **Portal (3) + ghost typeahead (4)** — build themed / ghost-capable LabelInput variants, or leave as-is.

Recommendation on file: keep errors below; for 7/8 prototype a right-edge adornment on `/dev` before touching the setup form.
