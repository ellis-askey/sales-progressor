# Email branding studio — spec

Part of the free-agency-launch arc (extends Phase 5.1 "agency logo"). Status: **planning, not started.** Written 2026-08-26.

Header style **confirmed Option B**: the logo's colour fills a full-width band edge-to-edge, directly above the coral milestone banner. (Ellis picked B over the white-chip option, 2026-08-26.)

---

## The problem

A director uploads their logo blind and hopes it looks right in client emails. Logos vary wildly (transparent, solid-colour background, wide wordmark, square monogram, artwork that bleeds to the edge). We can auto-detect and normalise well (proven this session across 10+ real and synthetic logos), but auto is never 100%. Directors need to **see the real email header and adjust until it's right.**

---

## What the director experiences

A "Email branding" card (director-only) on Account → Profile, expanded from today's `AgencyLogoSection`.

1. **Live preview of the real email top**: their colour band with their logo, then the coral half beneath with a sample address + "Mortgage offer received". This is exactly what buyers/sellers receive — same markup, same measurements.
2. **No logo yet** → preview shows today's design (coral banner, no band) with an "Upload your logo" prompt, so they see the before state.
3. **Upload** (drag/drop or browse, PNG/JPG/WebP/SVG, ≤2MB). We clean it automatically — trim the dead space, convert to email-safe PNG, detect the background colour — and the preview updates instantly to Option B.
4. **Adjustment tools** (all live, no save needed to preview):
   - **Background colour** — starts on the detected colour. Swatches: `Auto` (detected) · `White` · `Dark` · `Custom` (colour picker / hex). This is the key tool: it fixes a mis-detected colour, and lets a transparent logo sit on a brand colour instead of plain white.
   - **Size** — Small / Medium / Large (how tall the logo sits in the band).
   - **Alignment** — Left / Centre.
   - **Reset to auto**.
5. **Save** persists it; a confirmation shows and the preview reflects the saved state. Every client milestone email + the portal-invite email then carries the branded header.
6. **Remove** reverts to the text fallback (agency name).

Deliberately **not** in v1 (note for later, don't build): in-browser cropping, image filters, multiple logos, separate dark-mode logo, per-email-type overrides.

---

## Data model

Add to `Agency` (migration, **staging first** per Law 3):
- `logoPath String?` — already added.
- `logoTileColor String?` — hex band colour (detected or overridden).
- `logoScale String?` — `"sm" | "md" | "lg"`, default `"md"`.
- `logoAlign String?` — `"left" | "center"`, default `"left"`.

(Three explicit columns over a JSON blob, to match the codebase's column style. Open to a single `logoSettings Json?` if preferred.)

---

## Server pieces

- **`lib/image/logo.ts`** (new) — `normaliseLogo(buffer) => { png: Buffer; tileColor: string; width: number; height: number }`.
  - Trim uniform/transparent border → cap size (~240px tall, ~900px wide) → PNG.
  - **Detector** (built + proven this session): downscale to 320px; if a logo has >35% transparency it's "transparent" (light artwork → dark tile, dark artwork → light tile); otherwise it's opaque and the tile is its **dominant colour** (colour-frequency, so artwork bleeding to the edge doesn't fool it — this is what fixed the eXp case).
- **`app/api/agent/agency-logo/route.ts`** (extend) — POST runs `normaliseLogo`, uploads the PNG, stores `logoPath` + the detected `logoTileColor`, returns `{ url, tileColor }` so the client can seed the controls. New PATCH (or reuse POST) saves `{ logoTileColor, logoScale, logoAlign }`. DELETE clears all four.
- **Server action** `setAgencyLogoSettings({ tileColor, scale, align })` for the adjustment saves (validated: hex format, enum values).

## Client pieces

- **`components/account/v2/EmailBrandingStudio.tsx`** (replaces `AgencyLogoSection`) — upload + live preview + the three controls + save/remove. States: empty, uploading, uploaded-unsaved, saved, error, removing.
- The preview renders the **same header** as the email. To keep them in lockstep, extract the header into one source:
  - **`lib/email/logo-header.ts`** — exports the measurements/colours + `agencyLogoHeaderHtml({ logoUrl, tileColor, scale, align })` returning the band markup for emails. The React preview imports the same constants so it can't drift.

## Email rendering

- `richMilestoneEmailHtml` (portal.ts) — replace the current chip with the Option B full band via `agencyLogoHeaderHtml`, above the coral hero; **no band when there's no logo** (keep today's coral-top).
- `resolveAgencySenderForTransaction` — also select + return `logoTileColor`, `logoScale`, `logoAlign`.
- Portal-invite email (`app/api/portal/invite/route.ts`) — mirror the same header.
- Progressor (outsourced) sends stay unbranded, as now.

---

## Phasing (each staging → verify → prod)

- **A — foundation**: `lib/image/logo.ts` + migration + upload route returns detected colour + settings persistence. No visible UI change yet.
- **B — email switch**: milestone + invite emails render Option B from stored settings.
- **C — the studio UI**: upload, live preview, colour/size/align tools, save/remove.

Manual: the public `agency-logos` bucket exists on **staging** (created this session); **prod bucket still needed** (in ELLIS_MANUAL_TODO).

---

## Open decisions

1. **Location** — expand the section in Account → Profile (lean: yes), or a dedicated settings page?
2. **Tool set** — colour + size + alignment enough for v1? Anything to add/drop?
3. **No-logo fallback** — keep today's coral-top (lean), or show a neutral band with the agency name?
4. **Data model** — three columns (lean) vs one JSON field.
5. **Alignment default** — left (lean, letterhead feel) vs centre.
