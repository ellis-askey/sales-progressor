# Component registry

Every component as it moves through the lifecycle. **Empty** — populated one
entry at a time, by review. Mirrors the code registry in
`app/dev/components/_ds/registry.ts` (which is the live, rendered source).

Status: `Not reviewed` · `Proposed` · `Under review` · `Approved` · `Implemented` · `Deprecated`

| Component | Area / category | Status | Source | Variants | Notes |
|---|---|---|---|---|---|
| Type scale | Foundations / Typography | Approved | `design/tokens.ts` | Display → Eyebrow | Measured; auth headings diverge (flagged) |
| Text colours | Foundations / Colour | Approved | `design/tokens.ts` | — | Auth uses a cooler ink (flagged) |
| Status & semantic colours | Foundations / Colour | Approved | `design/tokens.ts` | success/warning/danger/info/snoozed | Auth hint amber diverges (flagged) |
| Coral / brand ramp | Foundations / Colour | Approved | `design/tokens.ts` | — | |
| Brand mark & lockup | Foundations / Iconography | Approved | `components/brand/BrandMark.tsx`, `app/login/page.tsx` | mark · lockup | Single source of truth for the mark |
| Auth page type | Foundations / Typography | Approved | `app/login/page.tsx` | title · subtitle | Coral accent stop |
| Labelled divider | Foundations / Borders & dividers | Approved | `WarmLoginForm.tsx` | — | |
| Card surface | Components / Cards & surfaces | Approved | `app/login/page.tsx` | — | 18px radius, layered shadow |
| Primary button (coral) | Components / Buttons & actions | Approved | `components/arc/button/button.tsx`, `WarmLoginForm.tsx` | lg | Coral via token override; loading stays focusable |
| SSO / provider buttons | Components / Buttons & actions | Approved | `WarmLoginForm.tsx` | secondary · lg | |
| Coral text link | Components / Buttons & actions | Approved | `WarmLoginForm.tsx` | default · hover | Hover → #E55B3D |
| Text field (LabelInput) | Components / Text inputs | Approved | `components/ui/LabelInput.tsx`, `WarmLoginForm.tsx` | email · password | Email lower-cased on blur; password reveal |
| Cookie consent banner | Components / Notifications | Approved | `components/analytics/CookieConsentBanner.tsx` | — | ICO equal-prominence CTAs |
| Trust row | Components / Badges & status | Approved | `app/login/page.tsx` | — | |
| Step progress | Components / Progress & timelines | Approved | `app/register/RegisterForm.tsx` | step 1 · step 2 | Second batch (register) |
| Password strength meter | Components / Progress & timelines | Approved | `components/auth/PasswordStrength.tsx` | — | |
| Checkbox | Components / Checkboxes, radios & toggles | Approved | `app/register/RegisterForm.tsx` | checked · unchecked | Animated tick |
| Radio group | Components / Checkboxes, radios & toggles | Approved | `components/arc/radio-group/radio-group.tsx` | — | Sliding coral highlight |

> Register also added a **ghost** button variant and an **arrow side-door** link
> variant — folded into the existing "Primary & ghost buttons" and "Coral text
> link" entries rather than new rows (same components).

> First batch captured from the login page (the cleanest page) as the starting
> reference, 2026-11-19. `Approved` here = approved as the starting reference;
> the precise canonical form of each is refined as we work through the app.
> Live, rendered source: `app/dev/components/_ds/components.tsx`.

> Add a row when a component is opened for review; keep its status current.
> `Implemented` ≠ migrated across the app — track migration in [DECISIONS.md](DECISIONS.md)
> and the `migration` category.
