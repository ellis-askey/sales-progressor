# Solicitor portal — discovery + plan (living doc)

**Status:** planning. Nothing built yet. We shape this doc until it's signed off, then build in stages.
**Owner:** Ellis
**Captured:** 2026-08-27 from Ellis's raw brief.
**One-line:** grow the existing `/s/[token]` solicitor-confirm surface into a fuller, mobile-first "solicitor portal" — their steps + a what's-due card (confirm + expected date + update together), the matter detail, the MOS, and a QR code in the chasing emails so they tap it on their phone, all presented as the agency.

**Law 1 note:** the adjacent spec is [docs/active/solicitor-confirm/scope.md](../solicitor-confirm/scope.md) (solicitor confirmation emails, demo-validated 2026-08-09). This doc **extends** that feature rather than forking it. Where the two disagree, we reconcile here in writing, not silently.

---

## 1. What Ellis asked for (raw brief, distilled)

> Build a solicitor portal — the steps either side — QR code in the email so they can tap on their phone (not their work computer) — then just provide the update and it comes in. So: their steps, then a card of what's due — confirm button, expected date, update (let them do expected and update together). Present as the agency, lean on "we'll keep the parties updated". Once they scan once (feeling safe because it's their phone, not a link on their work laptop) they'll realise it's legit — then we can attach the MOS, show specific details. Most of it is there to copy from the client portal; content/phrasing would be completely different, but the style helps massively. Solicitors will use it on phones but also desktop. Our confirm buttons on chasing emails would link in. So much more already built we can feed in.

Distilled to intents:
- **A** — A richer, standalone solicitor surface (a "portal"), not just an email-styled confirm page.
- **B** — Show the steps on **both sides** (context), with a **what's-due card** for the steps they own.
- **C** — **Confirm + expected date + update in one place**, ideally submit expected-date + update together.
- **D** — **QR code in the chasing emails** (tap-on-phone trust play).
- **E** — **Present as the agency**, leaning on the value prop "we keep the buyer/seller updated so you get chased less".
- **F** — Trust ladder: land → it's obviously legit → then surface **the MOS + specific matter details**.
- **G** — Cross-device (phone-first, desktop too).
- **H** — Reuse client-portal **structure/style**; solicitor **content/voice** is different.

---

## 2. What already exists (the big reframe — this is not greenfield)

A solicitor-facing surface is **already live** and does much of A/B/C/E. Evidence:

### The surface — `app/s/[token]`
- Public, no-login page ([app/s/[token]/page.tsx](../../../app/s/[token]/page.tsx)): agency "letterhead", a **Matter details** card (property, price, seller, buyer, their firm, who they act for), the solicitor-owned **steps for their side**, the **enquiries loop**, and a **raise-enquiries** panel.
- Per-step controls ([app/s/[token]/SolicitorRespond.tsx](../../../app/s/[token]/SolicitorRespond.tsx)): **Confirm this is done · Give an expected date · Provide an update** — as three separate actions today.
- A deliberate two-step **stop-emails** page (`/s/[token]/stop`) so email prefetchers can't silently unsubscribe.

### The auth model (solves "solicitors have no portal token")
- Token is a **stateless HMAC-signed string**, no DB row: `signSolicitorToken(transactionId, side)` → base64url of `"{txId}.{side}"` + HMAC-SHA256 keyed by `NEXTAUTH_SECRET` ([lib/solicitor-confirm/token.ts](../../../lib/solicitor-confirm/token.ts)).
- Scoped to **(file, side)**, never to a firm globally — a firm on many of our files can't confirm the wrong one. Every write re-verifies the token and double-gates (milestone side must match link side AND code must be in `solicitorCodesForSide(side)`). Rate-limited. `/s/` is whitelisted in `middleware.ts`.
- Why this shape: **a solicitor is reused across files**, so identity can't be a per-contact token like the client portal. Stated verbatim in the schema (`SolicitorChaseState`, ~line 2920).

### The confirmation writes to the shared record
- `Confirmer` union already has a solicitor variant (`{ kind: "solicitor"; firmId; contactId; firmName }`) — [lib/services/milestones.ts](../../../lib/services/milestones.ts). `completeMilestone` stamps `confirmedBySolicitorFirmId`/`confirmedBySolicitorContactId` on the same `MilestoneCompletion` the agent app + client portal read. **One confirmation updates everyone.**
- **Instant-through** (locked 2026-08-09): a solicitor confirming *is* a confirmation, no agent-review gate, including "ready to exchange" (VM18/PM25). Agent can override.
- `MilestoneCompletion.expectedDate` already stores a solicitor's expected date (a future date snoozes chasing). Free-text updates are stored as an internal-only `OutboundMessage` (never client-facing) + a `solicitor_update` bell to the agent/progressor — **not** a field on the completion.

### The chasing engine + emails
- Digest email builder ([lib/solicitor-confirm/digest-email.ts](../../../lib/solicitor-confirm/digest-email.ts)) → one email per (file, side), agency-branded navy letterhead, matter details, step list, CTA buttons all pointing at `{base}/s/{token}`, footer stop-link.
- Send cron ([lib/solicitor-confirm/chase.ts](../../../lib/solicitor-confirm/chase.ts)): softer cadence (grace 5 working days, repeat 7, cap 2, then escalate to team), per-side, respects pause flags + expected-date snooze, sends via `resolveAgencySenderForTransaction` (so it's **from the agency**), CCs the solicitor's `secondaryEmail`.
- Routing (locked): VM* → seller's solicitor, PM* → buyer's; shared codes to both solicitor + client (`lib/solicitor-confirm/codes.ts`).

**So the brief is mostly an evolution of `/s/[token]`, plus four genuinely new things.**

---

## 3. What's genuinely new (the delta to build)

1. **QR code in the chasing emails (D).** `qrcode@^1.5.4` is already a dependency (used in [app/command/setup-2fa/page.tsx](../../../app/command/setup-2fa/page.tsx)). `QRCode.toDataURL(confirmUrl)` server-side → embed the data-URI `<img>` in the digest email next to the existing button. Net-small.
2. **Both-sides context (B).** Today the page shows only the recipient's own side's open steps. Add a whole-file **progress overview** (both sides, read-only) borrowing the client portal's 6-stage strip, while confirmables stay own-side only.
3. **Combine expected-date + update (C).** Today three separate buttons. Fold "expected date + note" into one submit; optionally let a confirm carry a note/date in one action.
4. **MOS + documents + specific detail (F).** Surface the MOS (already stored as `TransactionDocument` with `source:"mos"`, served via `getSignedUrl`) and other agent-shared documents on the page, plus richer matter detail once trust is established.
5. **Richer, mobile-first "portal" shell (A/G/H).** Evolve the email-letterhead page into a proper portal layout (borrowing the client-portal skeleton), tuned professional rather than consumer.

---

## 4. Proposed design

### 4.1 Shape of the portal (one page, phone-first, desktop-fine)
A single `/s/[token]` page, scannable top-to-bottom:

1. **Header** — agency-branded (logo + name), "Sale progression". Presents as the agency (E). A short trust line: "We keep the buyer and seller updated, so you get chased less." (leans on the value prop).
2. **Matter details** — property, price, seller, buyer, their firm, who they act for (already built).
3. **Progress at a glance** — the 6-stage strip (Instructed → Draft pack → Searches → Enquiries → Exchange → Completion) computed for the **whole file**, so they see context for both sides (B). Read-only.
4. **What's due (their steps)** — the confirmable card(s) for their side. Per step: **Confirm it's done**, and an **expected date + short update** captured together in one submit (C). Instant-through (unchanged).
5. **Enquiries loop / raise panel** — as today, when relevant.
6. **Documents** — the MOS + any agent-shared documents, as signed download links (F). (Upload-back is a later phase — see decisions.)
7. **Footer** — sent-by-agency line + stop-emails link.

### 4.2 The QR flow (D)
- The digest email keeps its tappable CTA button **and** gains a QR block ("Prefer your phone? Scan this") encoding the same `{base}/s/{token}` link.
- Scanning opens the portal on their phone — the trust play: it *feels* safer than clicking a link on a locked-down work laptop, and once they land they see it's legit.

### 4.3 The "what's due" card (C)
- Replace the three-separate-buttons pattern with: a primary **Confirm it's done**, plus a single **"Add an expected date / update"** affordance that reveals a date field **and** a note field, submitted together in one action (writes `expectedDate` + posts the internal note + snoozes chasing in one go).

---

## 5. The design-tension call (needs a decision — see D1)

The current `/s/` page is deliberately **professional/utilitarian** (navy letterhead, no glass, "Dear Sir or Madam" register) to earn a solicitor's trust. The client portal is **warm/consumer glass**. Ellis wants to "lean on the client portal for style" but with different content.

Three options:
- **(a) Keep the professional letterhead skin**, just add the new sections (progress strip, documents, combined card). Lowest risk, most "law-firm-appropriate".
- **(b) Full client-portal glass skin** (`.portal-ambient`, glass cards, portal tokens). Prettiest, but risks reading as consumer-soft to a solicitor.
- **(c) Hybrid (recommended):** borrow the client portal's **structure and mobile polish** (progress strip, step cards, timeline, bottom-sheet interactions) but keep a **restrained professional skin** — its own `ui.ts` palette (like `/quote` has), cool/neutral, agency-branded, no playful warmth. Best of both: familiar structure, appropriate tone.

---

## 6. Reuse map (what to clone, what's solicitor-specific)

**Clone / adapt from the client portal (structurally generic):**
- `PortalShell` chrome, `PortalSheet` bottom-sheet, drawer machinery.
- The 6-stage overview strip logic (from `app/portal/[token]/page.tsx`) for "progress at a glance".
- `PortalMilestoneList` swipe/group/confirm patterns as a model for the step cards.
- The public-token page skeleton from `app/quote/[token]/` (`page.tsx` force-dynamic + token lookup, own `ui.ts` palette, `actions.ts` re-validated server mutations, `<Flow>.tsx` client component). **This is the closest analogue.**
- Documents: `TransactionDocument` + `getSignedUrl`/`getSignedUrlMap`, `listLiveTransactionDocuments` pattern.
- Sender: `resolveAgencySenderForTransaction(txId)`.
- QR: `QRCode.toDataURL(url)`.

**Solicitor-specific (do NOT reuse the client's version — needs its own):**
- **Auth:** stateless `(file, side)` HMAC token — already exists, keep it. Not `Contact.portalToken`.
- **Scope:** a solicitor sees the **whole file** (both sides), not the client's own-side/other-side/round split.
- **Confirmable set:** the six bilateral/agent-only codes the client portal *hides* (VM18/PM25 readiness etc.) are exactly what a solicitor *may* confirm — the block set inverts. Use `solicitorCodesForSide`.
- **Voice/copy:** professional register, not the consumer `lib/portal-copy.ts`. New copy layer (`lib/solicitor-confirm/codes.ts` already has `solicitorStepLabel`).
- **No consumer cards:** team/chain-agent/costs/broker/onward/tips are buyer-seller concepts — omit.

---

## 7. Security + trust considerations (needs decisions — D5)

The stateless token is elegant but has properties worth deciding on before we surface **documents + more matter detail**:
- **No expiry today.** A forwarded/leaked `/s/` link exposes matter details (and, post-change, the MOS). For a richer portal we should consider a **token expiry** (e.g. signed with an issued-at, valid N days) and re-issue on each chase email, and/or a **light gate before documents** (e.g. confirm the property postcode) — standard for exposing documents to an unauthenticated link.
- **What may a solicitor see of the *other* side?** Progress context is fine; the *other party's* private contact details are not. Define the read surface carefully (property/price/their-own-client names are fine; the counterparty's personal data is not).
- **Documents:** which docs? MOS only, or all agent-shared? Read-only, or can they upload back (e.g. draft contract)? Downloads via 60s signed URLs per the document-sharing spec.

---

## 8. Open decisions (this is what we shape)

- **D1 — Design skin: LOCKED (c) hybrid** (2026-08-27) — client-portal structure + mobile polish, restrained professional skin with its own palette. No consumer warmth/glass.
- **D2 — Scope of what they see:** own-side steps only (today), or whole-file **progress context** (read) + own-side confirmables. *Lean: whole-file progress + own-side confirm.*
- **D3 — Combined action:** fold expected-date + update into one submit; and should a **Confirm** optionally carry a note/date in the same action? *Lean: yes to combining; confirm stays a clean one-tap with optional note.*
- **D4 — Documents: LOCKED (2026-08-27) — MOS only, view/download only.** No other shared docs yet; "send back to us" (solicitor uploads a doc — draft contract, searches, enquiry replies, ID — straight onto the file) is a later phase, needs type/safety checks + routing.
- **D5 — Token security: LOCKED (2026-08-27).** Add **link expiry (~30 days) + a fresh link in every email**; active solicitors never notice (each email renews it), only stale/forwarded links die. **No postcode/document gate while it's MOS-only** (the acting solicitor already holds the MOS) — revisit a light one-time check only if we later share genuinely sensitive docs. Frictionless access (no password/gate) for confirming, dating, updating, and viewing the MOS is preserved. Future direction: a proper multi-case solicitor **login** (toggle between their files) layers on top much later and replaces the magic link only for solicitors who opt in — nothing here blocks it.
- **D6 — QR placement:** QR block in every chasing digest email alongside the button (both), or QR-only? *Lean: both — button + QR.*
- **D7 — Trust copy:** exact "we keep the parties updated" framing. **Ellis approves the string in context at implementation time** (needs to see what surrounds it on the page), not now.
- **D8 — Relationship to solicitor-confirm scope.md:** confirm this doc **extends** that feature (same token, same routing, same cadence, same sender) and we don't fork. *Lean: yes.*
- **D9 — Build order:** which of §3's five deltas ships first. *Lean: QR (tiny, immediate value) → combined card → progress-at-a-glance → documents → skin polish.*

---

## 9. Suggested build stages (draft — refine after decisions)

1. **QR in the digest email** — smallest, immediate trust value. No schema change.
2. **Combined expected-date + update** on the what's-due card — UX change to `SolicitorRespond`.
3. **Progress-at-a-glance** (whole-file 6-stage strip, read-only) added to the page.
4. **Skin pass** to the agreed design (D1) — own `ui.ts`, mobile-first layout.
5. **Documents (MOS + agent-shared)** surfaced with signed links, behind the agreed security gate (D5).
6. **Token hardening** (expiry + reissue) if chosen.

Migrations (if any — e.g. token issued-at, document visibility) go **staging-first** (Law 3). Most of stages 1–4 need no migration.

---

*Next: Ellis comments on D1–D9; we lock them into this doc, then build in the agreed order.*
