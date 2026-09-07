# Email signature — audit & implementation plan

**Status:** AUDIT + PLAN for review. Nothing implemented.
**Date:** 2026-09-07
**Goal:** extend the existing agent email signature into three options (Basic TSP,
Signature image, Custom pasted signature) with one resolver feeding every surface.

---

## 1. How signatures work today (plain English)

There is exactly **one** real, reusable signature today, and it only powers the
**manual chase email**. Everything else rolls its own sign-off.

- The builder is [lib/email/chase-signature.ts](../../../lib/email/chase-signature.ts):
  `buildChaseSignatureHtml()` (HTML) and `buildChaseSignatureText()` (plain text).
- It is **generated dynamically** at send/preview time. **Nothing is stored.** There
  is no signature field in the database.
- It reads, per **sending agent** (User): `name`, `image` (photo), `jobTitle`,
  `directMobile` (falls back to `phone`). It reads, per **agency** (Agency):
  `name`, plus the logo band from `logoPath` / `logoTileColor` / `logoScale` /
  `logoAlign`. Note: the agent's **email is NOT rendered** in the sign-off (only
  used for the From/Reply-To header).
- It renders **only the fields that exist**, so it looks intentional whether the
  agent has filled everything in or just has a name. Missing pieces (photo, job
  title, mobile, agency logo) are surfaced by `chaseSignatureMissing()` and drive a
  "finish your signature" nudge in the drawer.
- The agency **logo** is rendered by `agencyLogoHeaderHtml()`
  ([lib/email/logo-header.ts](../../../lib/email/logo-header.ts)) — the same
  renderer the branding-studio preview uses — from the public `agency-logos`
  Supabase bucket via `getAgencyLogoUrl()`.
- It is therefore **both per-user and per-agency**: the personal block is the agent;
  the logo/name band is the agency. Assembled fresh each time.

Flow today (chase only):

```
Profile fields (name, photo, jobTitle, mobile) + Agency logo/name
        ↓  (read live)
buildChaseSignatureHtml() / buildChaseSignatureText()   ← the one builder
        ↓
/api/chase/signature-preview  →  ChaseDrawer "How it signs off" block
/api/chase/send-email         →  appended to body  →  sendEmail() (SendGrid)  →  recipient
```

Because the preview endpoint and the send route build the input **identically** and
call the **same** builder, the drawer preview matches the actual send — for the
**Send chase** button. (Caveats in §8.)

**Every other email path has its own hardcoded sign-off** (see §8/§9) — there is no
shared "signature system" yet. That is the main thing this project introduces.

---

## 2. Where the new setting should live

Settings IA (agent app) is the route group `app/(account)/` → `/agent/account/*`,
nav defined in [components/account/chrome/AccountLeftNav.tsx](../../../components/account/chrome/AccountLeftNav.tsx):
Billing · Profile · Team · Notifications · Connections · Security · **Emails** (director-only).

- The signature is **per-agent identity** (name, photo, title, mobile). Its natural
  home is the **Profile page** (`app/(account)/agent/account/profile/page.tsx`),
  which already renders exactly those fields **and** a director-only "Email branding"
  card (`EmailBrandingStudio`) for the agency logo.
- Add a new **"Email signature"** `AccountCard` on the Profile page, beside "Email
  branding", reusing the existing `AccountCard` + `profile-grid` layout.
- **Not** the Emails page — that is director-only and agency-wide (client-email copy);
  a per-agent signature there would be the wrong scope.

---

## 3. Proposed three-option UX

On the Profile page, a new card:

```
EMAIL SIGNATURE
How your emails sign off.

( ) Basic          Created automatically from your details.
( ) Signature image  Use an image of your existing signature.
( ) Custom         Paste the signature you already use.

[ live preview of the selected option, using the real builder ]
```

- **Basic** (default): show the current auto signature; the existing Profile fields
  keep driving it; live preview via the real builder. Nothing new to configure here.
- **Signature image**: two setup methods for the SAME option — **Upload image** or
  **Paste image URL** (we import it, see §5). Live preview shows the image as it will
  render. Remove reverts to Basic.
- **Custom**: a paste area that captures the formatting from the clipboard (like
  pasting into Outlook), shows a WYSIWYG preview, and stores sanitised HTML. The user
  never sees raw HTML. Remove reverts to Basic.

Always available: preview, switch type, edit/replace, remove, and switch back to
Basic. Basic can never be "empty" — it's always derivable from profile fields.

---

## 4. Basic TSP signature — keep as-is

`lib/email/chase-signature.ts` is already the Basic option, and it's well built
(inline styles + table layout for email clients, escapes every user field, renders
only present fields). **No redesign needed.** The only change: it becomes **one branch
of a resolver** (§7) rather than being called directly. Existing agents stay on Basic
automatically (the new `signatureMode` defaults to `BASIC`), so nobody loses a
signature or has to reconfigure.

---

## 5. Signature image (one option, two setup methods)

**Reuse the avatar upload pattern** — [app/api/agent/upload-avatar/route.ts](../../../app/api/agent/upload-avatar/route.ts)
+ `uploadAvatar()` in [lib/supabase-storage.ts](../../../lib/supabase-storage.ts).
It already validates `image/jpeg|png|webp`, caps at 5MB, upserts to a **public**
bucket and returns a cache-busted public URL. Public URL is essential — email
clients must load it for months without an expiring signed URL.

**Recommendation: both methods converge to a stored image in our own bucket.**
- **Upload**: new `uploadSignatureImage()` mirroring `uploadAvatar`, to a public
  `signatures` bucket at `signatures/{userId}.{ext}` (a new bucket = one manual step
  for `ELLIS_MANUAL_TODO.md`).
- **URL**: don't hotlink the remote image. **Fetch it once, validate, and store it in
  our bucket** (same as an upload). Reasons: (a) privacy — hotlinking leaks every
  recipient's open + IP to the third-party host; (b) reliability — the remote image
  can vanish and break every sent email; (c) security — we control content-type/size.
  So "URL" is really "import from URL".

Constraints (both methods): PNG/JPG/WebP, transparency preserved (PNG/WebP), max file
~1MB, max stored dimensions ~1200px wide, **rendered** max width ~600px (email-safe),
`width`/`height` attributes for retina sharpness, `max-width:100%` for mobile. Validate
`Content-Type` and magic bytes on import; HTTPS-only for URL import. Fallback if the
image fails to load: `alt` text = agent + agency name.

---

## 6. Custom signature (paste, WYSIWYG, no raw HTML)

The target experience: paste your existing signature (Outlook/Gmail/Exclaimer/
WiseStamp) and keep sensible formatting, images, links, tables.

**Nothing to reuse — there is no HTML sanitiser and no rich-text editor in the repo
today** (confirmed: no `dompurify`/`sanitize-html`/`xss`, no `tiptap`/`slate`/`quill`/
`lexical`). This is the one genuinely new piece of infrastructure.

Recommended approach:
- A **paste-capture area** (a `contentEditable` div) that reads `text/html` from the
  clipboard on paste — this is how you get Outlook/Gmail's rich markup. Show it
  rendered (WYSIWYG), not as code.
- **Sanitise server-side before storing and before sending** with
  `isomorphic-dompurify` (works in Node route handlers). Allowlist:
  - Tags: `p, div, span, br, a, img, table, thead, tbody, tr, td, th, strong, b, em,
    i, u, ul, ol, li, h1-h4, font`
  - Attributes: `href` (http/https/mailto/tel only), `src` on img (see below),
    `width, height, alt, style, align, valign, colspan, rowspan, color, cellpadding,
    cellspacing, border`
  - Inline `style`: allowlist properties (color, background-color, font-*,
    text-align, padding, margin, width, height, border, vertical-align,
    line-height). Strip `position`, `expression()`, `url()` except approved.
  - **Strip entirely**: `<script>`, all `on*` handlers, `<svg>`, `<iframe>`,
    `<object>`, `<style>`/external CSS, `<link>`, `<meta>`, `javascript:` URLs.
  - Outlook conditional comments / `mso-` junk: drop (harmless once stripped).
- **Images inside custom HTML**: normalise. Options — (a) rewrite remote `src` to
  imported copies in our bucket (best, but heavier), or (b) allow https images with a
  size guard + block tracking pixels (1x1). Recommend (b) for v1, (a) later. Cap
  `data:` URIs to a small size or convert to a stored asset.
- **No "paste HTML" box for normal users.** An optional advanced "edit raw HTML"
  fallback is possible later but not required for v1.

---

## 7. One signature system (the resolver)

Today only the chase path has a reusable builder; everything else is bespoke.
Introduce one authoritative resolver and make the **agent-authored** surfaces consume
it:

```
resolveEmailSignature({ userId, agencyContext }) : { html, text }
  BASIC  → buildChaseSignatureHtml/Text  (existing, unchanged)
  IMAGE  → <img> block from the stored signature image
  CUSTOM → the stored sanitised custom HTML (+ a derived text fallback)
```

- Wrap the existing builder; do not replace it. `send-email` and `signature-preview`
  already call the builder — they switch to calling the resolver, so the drawer
  preview stays correct for free.
- **Scope honesty:** "every email surface" cleanly means the **agent-authored** ones
  (manual chase, AI chase, "open in my email", manual composer). The **system/agency**
  emails (portal milestone emails, client-chase digests, solicitor digests, chain
  notifications, exchange-day) have their own agency/system footers and a different
  purpose; folding those into the personal signature resolver is a **larger, separate
  effort** and mostly not wanted (a milestone email shouldn't sign off as one agent).
  Recommend: v1 governs agent-authored sends; note the duplication (§8) as future
  consolidation, don't rewrite it now (avoid overbuild).

---

## 8. Coverage table (every email surface)

| Surface | Current signature source | Preview? | Actual send path | Change required |
|---|---|---|---|---|
| **Chase drawer → Send chase** | `buildChaseSignatureHtml` via `/api/chase/signature-preview` | Yes | `/api/chase/send-email` → `sendEmail` (same builder) | Point both at the resolver (Basic/Image/Custom) |
| **Chase drawer → Open in my email** | Shows white-label block in preview | Yes | `mailto:` body only — **no white-label sig** (user's own client sig used) | 🚩 Preview≠send. Decide: hide the preview block for this button, or note it |
| **AI chase generation** | AI body ends "Best regards, {first}" (text only) | Yes (in drawer) | body returned, sig appended by send route | 🚩 Double sign-off (text + white-label). Suppress the AI text sign-off when Image/Custom is used |
| **Manual composer (ComposeEmail)** | None (plain text, verbatim) | No | `/api/agent/send-email` → `sendFromVerifiedAddress` | Optional: offer the resolver signature here too |
| **Auto-chase "View" modal** | Real HTML via same cron builders | Yes | client/solicitor digest builders | No sig change (system emails; out of scope) |
| **Queued email preview / detail** | Shows **text/plain** part ("Thanks, {agency}") | Yes | HTML part has **no closing sign-off** | 🚩 text≠HTML; label "what most recipients see" is misleading (pre-existing) |
| **Automated emails list preview** | Metadata only (no body) | No | queue → cron | None |
| **Chase timeline "Next email" edit** | text part sign-off (matches send text) | Yes | digest builders | None (system email) |
| **Prospects follow-up composer** | None in composer | Yes | `lib/prospects/send.ts` appends Ellis signature image | 🚩 Preview omits the appended signature (CC-only feature) |
| **Portal client→solicitor follow-up** | `mailto:` handoff (client's own client) | Yes | client's mail app | None (outside our send) |
| **Email logs / CommsEntry** | Logger, not a sender | n/a | n/a | None |
| **Test email** | Does not exist | n/a | n/a | None |

System/automated send paths with their own hardcoded sign-offs (not agent signatures,
listed for completeness): enquiries chase, solicitor-confirm digest, client-chase
digest, portal milestone emails, exchange-day, chain notifications, outsource-intro,
prospect outreach. **Left as-is in v1.**

---

## 9. Sender / signature precedence rules

Sender identity today:
- Chase/manual: `resolveSenderForTransaction(txId, sessionUser)` — the acting agent's
  verified address, falling back to the agency resolver.
- Agency correspondence: `resolveAgencySenderForTransaction(txId)` — agency-branded
  display name, agency verified domain, else SP default `updates@thesalesprogressor.co.uk`.

Recommended **signature** precedence for the new system (agent-authored sends):
1. The **acting sender's** own signature setting (Basic/Image/Custom) — signature
   follows **whoever is sending**, per-user.
2. If the sender has no configured mode → **Basic** (always derivable; never empty).
3. Internal progressor sending on an agency's behalf: use the **progressor's** own
   signature (they are the author), Basic by default. (Confirm with Ellis — this is
   the one genuine business-rule choice.)
4. No new agency-level signature default in v1 (agency identity already comes through
   the logo band inside Basic). Revisit if agencies ask for a shared signature.

---

## 10. Data model (minimum change)

Add to **User** (per-agent, matches current identity scoping):

```
enum EmailSignatureMode { BASIC IMAGE CUSTOM }

User.emailSignatureMode       EmailSignatureMode @default(BASIC)
User.emailSignatureImagePath  String?   // stored asset in the signatures bucket
User.emailSignatureHtml       String?   // sanitised custom HTML
```

- No separate `signatureImageUrl` field — URL import stores into
  `emailSignatureImagePath` (§5), so there's one image source of truth.
- Default `BASIC` → **every existing agent keeps their current signature with zero
  migration and no reconfiguration.** Backwards compatible.
- Migration: staging first (Law 3). One additive migration, no backfill needed.

---

## 11. Security & deliverability

- **XSS / custom HTML**: the real risk. Sanitise server-side on save AND before send
  (defence in depth), allowlist tags/attributes/styles (§6), strip scripts, `on*`
  handlers, SVG, iframes, external CSS, `javascript:` URLs.
- **Tracking pixels**: strip 1x1 / zero-size images; consider stripping all remote
  images in favour of imported copies later.
- **Images**: size/type validation, dimension caps, HTTPS-only, magic-byte check,
  import remote → our bucket. Cap `data:` URIs.
- **Deliverability**: keep signatures lightweight (large/base64 images hurt spam
  scores and Gmail clipping at ~102KB); table + inline styles only (already the house
  style); `max-width:100%` for mobile; `alt` fallbacks.
- **Outlook double-signature: NOT a risk.** The Microsoft integration is **read-only
  ingestion** — every outbound email goes via **SendGrid**, never the user's Outlook
  mailbox, so no server-side Outlook signature is ever appended. (The granted
  `Mail.Send` scope is unused; flag if anyone wires a Graph send later.)

---

## 12. Existing code to reuse

- [lib/email/chase-signature.ts](../../../lib/email/chase-signature.ts) — **the spine.** Becomes the Basic branch of the resolver.
- [app/api/chase/signature-preview/route.ts](../../../app/api/chase/signature-preview/route.ts) + `send-email/route.ts` — already call the builder identically; switch both to the resolver and the preview stays correct.
- [app/api/agent/upload-avatar/route.ts](../../../app/api/agent/upload-avatar/route.ts) + `uploadAvatar()` — the upload pattern for the image option.
- [lib/email/logo-header.ts](../../../lib/email/logo-header.ts) — logo band renderer (Basic keeps using it).
- `components/account/chrome/*` (`AccountCard`, `AccountPageHeader`, Profile `profile-grid`) — the settings UI primitives.
- `EmailBrandingStudio` (Profile) — the sibling card + preview pattern to mirror.
- **New dependency required:** `isomorphic-dompurify` (no sanitiser exists).

---

## 13. Recommended implementation (cleanest fit)

Existing email system + **one signature resolver** + **new Profile card** + **image
storage/import** + **custom-HTML sanitisation**, with the two existing chase surfaces
(send + preview) switched to the resolver so preview↔send parity is preserved for
free. No rewrite of the system/automated email templates.

---

## 14. Implementation phases (safe order)

1. **Schema + resolver skeleton.** Add the 3 User fields (default BASIC, staging
   migration). Build `resolveEmailSignature()` wrapping the existing builder; BASIC
   only. Point `send-email` + `signature-preview` at it. No UX yet → zero behaviour
   change, everyone still on Basic. Verify parity.
2. **Settings card — Basic.** Add the "Email signature" card to Profile showing the
   three choices with Basic selectable + live preview. Still only Basic functional.
3. **Signature image.** `signatures` bucket + `uploadSignatureImage`, upload + URL
   import, resolver IMAGE branch, preview, remove/revert.
4. **Custom signature.** Add `isomorphic-dompurify`, sanitiser + allowlist, paste
   area + WYSIWYG preview, resolver CUSTOM branch. Suppress the AI text sign-off when
   mode ≠ BASIC.
5. **Polish + parity sweep.** Fix the flagged mismatches you want fixed (open-in-my-
   email, queued-preview label), verify every agent-authored surface renders the
   resolved signature, test across Gmail/Outlook/Apple Mail.

---

## Flagged: preview ≠ actual send (today, pre-existing)

1. **Chase drawer "Open in my email"** shows the white-label sign-off in the "How it
   signs off" block, but the `mailto:` it opens has **no** white-label signature (the
   agent's own mail-client signature is used instead).
2. **AI chase double sign-off**: the AI body already ends "Best regards, {name}" and
   the white-label block is **also** appended — two sign-offs. Consistent between
   preview and send, but redundant, and will look worse with Image/Custom.
3. **Queued email preview** shows the **text/plain** part (ends "Thanks, {agency}")
   under a label "what most recipients see", but the **HTML** actually sent has **no
   closing sign-off** — so the previewed sign-off isn't what an HTML inbox shows.
4. **Prospects follow-up composer** shows no signature, but the send appends Ellis's
   signature image.
