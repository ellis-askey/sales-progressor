# components/compose

Agent email composition. One shared writing surface, with the host-specific
chrome (recipients, scheduling, tones) living in each host.

| Component | What it is | Why it's domain-specific (not a `components/ui` primitive) |
|---|---|---|
| **`MessageEditor.tsx`** | **The canonical rich-text message editor** — ONE writing experience for every place an email is composed. Controlled (`valueHtml` / `onChangeHtml`) with an eyebrow (label · templates · mic · regenerate), a toolbar (bold / italic / lists / inline link / attach / signature-style), plain-text paste, dictation, attachment caps + chips, and an optional AI **Refine**. Each host passes only the optional slots it has. | Encapsulates email-writing behaviour (signature-style swap contract, dictation, attachment model), not a generic text box. The one place to change how composing an email feels. |
| `ComposeEmailModal.tsx` | The "New email" pop-up: search a sale, pick To/Cc/Bcc, schedule-send, thread-continue, share-our-latest / full-chain inserts. Delegates the body to `MessageEditor` (controlled `bodyHtml`); programmatic edits (templates, share, refine, sig swap, auto-greet) transform the HTML string off-DOM. | Owns the whole compose-and-send flow + its own floating/modal chrome. |
| `ComposeEmailButton.tsx` | The trigger that opens `ComposeEmailModal`. | Thin launcher; carries the open-state + prefill. |
| `TemplatePicker.tsx` | Email-template browser/preview panel, opened from `MessageEditor`'s templates button; inserts into the body. | Template IO + preview, not a generic picker. |
| `FloatingWindow.tsx` | The draggable floating-window frame the composer can dock into. | Bespoke window chrome for the composer. |

**Canonical rule:** anywhere an email body is written, use `MessageEditor`. The
chase drawers (`components/chase/ChaseDrawer`, `ChaseNeighbourDrawer`) and the
New-email modal all route through it. The old bespoke `ChaseComposer` and the
modal's inline editor were folded into it (2026-11) and removed — do not
re-introduce a second composer.
