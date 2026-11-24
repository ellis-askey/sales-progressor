# Decisions log

What has been **approved**, what was **rejected**, and why. Append-only in
spirit: don't rewrite a past decision without explicit approval — supersede it
with a new, dated entry that references the old one.

---

### 2026-11-19 — Login page adopted as the starting reference
- **Area / component:** Foundations + Components — first batch (10 entries).
- **Status:** Approved (as the starting reference).
- **Decision:** The login page is the cleanest page in the app; its elements are
  captured as the canonical starting point — brand mark & lockup, auth type,
  labelled divider, card surface, primary (coral) button, SSO buttons, coral
  link, text field (LabelInput, email + password), cookie banner, trust row.
- **Rationale:** Seed the system from the known-good page rather than from
  invented tokens; everything else is measured against it.
- **Scope:** Design-system only. **No production change** — these already ship
  on the login page; nothing was migrated or altered.
- **Protected exceptions captured:** coral-by-token-override, loading-stays-focusable,
  email-lower-cased-on-blur, password reveal, ICO equal-prominence CTAs — see
  [EXCEPTIONS.md](EXCEPTIONS.md) and each entry's "Existing Behaviour & Exceptions".
- **Open:** precise canonical form of each is refined as we work the app; a
  dark-theme canonical for these light-only auth specimens is still to be decided.

### 2026-11-19 — Register page captured (new elements only)
- **Area / component:** 4 new entries + 2 folded variants.
- **Status:** Approved (starting reference).
- **Decision:** The register page was compared to the login batch; already-covered
  elements (brand lockup, heading/subtitle, card, inputs, coral primary, coral
  links) were confirmed canonical and not duplicated. New: **step progress**,
  **password-strength meter**, **checkbox** (animated tick), **radio group**
  (sliding coral highlight). The **ghost** button and **arrow side-door** link
  were folded into the existing Button / coral-link entries as variants.
- **Scope:** Design-system only. No production change.
- **Font aside:** confirmed the whole app (incl. inputs) is one typeface — **Geist**
  (`body` → `var(--font-geist-sans)`); no inconsistency. Changing the typeface
  remains an open, app-wide decision if ever wanted.

### 2026-11-19 — Progress specimens refined + Play/Reset pattern
- **Step progress:** keep OUR coral bar look; adopt ONLY the arc Stepper's motion
  (segments fill one after another as progress advances).
- **Password strength:** canonical is the **bar + the strength word at the end**
  (Too short → Strong) — the rule checklist is dropped. Delta vs the live
  `components/auth/PasswordStrength.tsx` (word under the bar, no Too-short state)
  recorded as a protected difference; reconcile in a future migration.
- **Pattern:** animated specimens carry a **Play** (runs through all stages) +
  **Reset** control. DS-only; no production change.

### 2026-11-19 — Typography + colour foundation captured (Track A)
- **Status:** Approved as the documented canonical (measured from `design/tokens.ts`, DoD-locked).
- **Type scale:** Display 32 · H1 28 · H2 22 · H3 17 · H4 15 · Body 14 · Body-sm 13 · Caption 12 · Micro 11 · Eyebrow 10. Geist; weights 400/500/600; line 1.25/1.5/1.7; tracking −0.01/0/0.02/0.05em.
- **Colour:** text ramp (#2D1810 → muted), status (success #1F8A4A, warning #C97D1A, danger #C73E3E, info #3D7AB8, snoozed #7E22CE), coral ramp.
- **Divergences flagged for reconciliation (OPEN — your call):**
  1. Auth H1 is ~30px / weight **800** / cool **#20242E**; scale is 28px / **600** / warm **#2D1810**.
  2. Auth body ink is cool (#20242E / #8A8A94) vs the warm token ramp.
  3. Register's “too short” hint uses **#B05A20**, not the token warning **#C97D1A**.
- **Gaps found (missing states — to add in Track B):**
  - No inline **invalid-email** error on login or register (bad format just silently blocks).
  - **Loading states** only partial (submit buttons yes; SSO buttons just disable; no field-level busy).
- **Scope:** DS-only. No production change.

### 2026-11-19 — Auth aligned to the scale (APPLIED to production)
- **Approved via** `/dev/components/compare/auth-type`.
- **Applied:** login + register H1 → 28px / semibold 600 / warm #2D1810 / −0.01em (was 30px/800/#20242E); muted body ink #8A8A94 → rgba(45,24,16,0.55); register warning hint #B05A20 → token #C97D1A. Files: `app/login/page.tsx`, `components/login/WarmLoginForm.tsx`, `app/register/RegisterForm.tsx`. The three divergence flags are now resolved.
- **Gaps — PROPOSED (not in production yet):** `field-error-email` (invalid-email inline error — awaiting string confirmation) and `loading-states` (SSO spinner — comparison at `/dev/components/compare/loading-states`). Both DS entries, status `proposed`.

### 2026-11-20 — Approved batch APPLIED to production
- **Invalid-email error** ("Enter a valid email address") + **SSO loading spinner** → live on login/register. (`field-error-email`, `loading-states` → implemented.)
- Approved via `/dev/components/compare/register-canonical`, applied:
  - **Step progress** → register bar now fills segments sequentially (scaleX). (`step-progress` → implemented.)
  - **Password strength** → word moved to the end of the bar (`components/auth/PasswordStrength.tsx`, used by register / invited / reset). Too-short stays DS-only; register keeps its specific "At least 10 characters required" hint for <10. (`password-strength` → implemented.)
  - **Toggle reconciled** → the cookie banner's arc Switch swapped to our LiquidToggle (`components/arc/cookie-consent/cookie-consent.tsx`), so one toggle app-wide. (`toggle` divergence resolved.)
- **Still open:** cookie banner's X-close + reopen button are uiarc defaults — no canonical close/icon-button exists yet to reconcile them to.
- **Process fix adopted:** each component now also gets its sub-elements + every state catalogued, and imported sub-components reconciled against our canonicals (this is how the toggle slipped).

---

## Template

```
### YYYY-MM-DD — <short title>
- **Area / component:** …
- **Status:** Approved | Rejected | Superseded by <date>
- **Decision:** what was decided, precisely.
- **Rationale:** why; alternatives considered.
- **Scope:** design-system only, or authorised for production migration?
- **Protected exceptions touched:** link to EXCEPTIONS.md entries, if any.
```

An approval of a design-system decision does **not** by itself authorise
application-wide production changes — note production authorisation explicitly.
