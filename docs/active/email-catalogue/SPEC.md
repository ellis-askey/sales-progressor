# Email Catalogue — Command Centre

**Status:** in build (spec agreed 2026-09-08). Source of truth for the feature.
**Surface:** `/command/emails` (superadmin only, Command Centre visual system).
**Why:** we send ~45 distinct emails from many code paths, under different
identities (self-managed vs outsourced), to different recipients (client, agent,
internal, solicitor). Nobody can currently see the *total* set in one place, so
we can never be fully confident what lands in a real inbox. This is the "show me
every email, exactly as it sends, under every identity" view.

Founder decisions (2026-09-08):
- **Coverage:** everything — client, agent, internal, solicitor, chain AND
  platform/system emails.
- **Milestones:** one representative per recipient/side, plus a code picker to
  load any specific milestone's exact text on demand.
- **Delivery:** full build, one delivery (no phased review gates).

---

## Principle: render the real builders

Every specimen renders by calling the **real** email builder with fixture data —
never a reproduction. Same code that emails real people. Where a builder is
currently inline in a route handler (e.g. the portal invite), it is first
extracted into a reusable `lib` builder (good hygiene, Law 14) and both the route
and the catalogue call it. This guarantees the catalogue matches production by
construction; it cannot silently drift.

Fixtures live in `lib/command/email-catalogue/fixtures.ts` — a fake agency
("Preview Estates"), fake vendor/purchaser/solicitor contacts, a fake chain, and
sample milestone data. All clearly synthetic. No live tenant data is read, so the
page is safe to open on any environment and raises no multi-tenant concern.

---

## The scenario model

A specimen renders under a **scenario** chosen from the toolbar:

| Axis | Values | Affects |
|---|---|---|
| `fileType` | `self_managed` \| `outsourced` | sender identity + signature |
| `side` | `vendor` \| `purchaser` | which client copy renders |
| `theme` | `coral` (default) \| `custom` (sample navy/teal) | client-email branding |
| `milestoneCode` | any code (picker) | milestone specimen text |

Not every axis applies to every specimen; each specimen declares which axes it
responds to, and the toolbar greys out the rest.

### Identity resolution

Alongside the rendered body, every specimen shows an **identity strip**: the
exact `From`, `Reply-To`, fallback, signature type, and theme for the current
scenario. This is computed by a pure `resolveCatalogueIdentity(scenario, spec)`
that encodes the founder-approved sender map and the signature rule:

- Sender: mirrors `resolveAgencySenderForTransaction` — outsourced → agency
  verified sender else progressor fallback; self-managed persona "personal" →
  agent's own address (authenticated domain) else agency/SP fallback.
- Signature: mirrors `resolveAgentSignatureForFile` — self-managed → agent's own
  signature; outsourced → in-house block (`buildInHouseSignoff`) / null.

**Follow-up (tracked):** extract the pure decision core of
`resolveAgencySenderForTransaction` so the live resolver and the catalogue call
one function and cannot drift. Until then the catalogue identity strip is
labelled "per the sender policy" and unit-tested against the approved map.

---

## Architecture

```
lib/command/email-catalogue/
  fixtures.ts        fake agency / contacts / chain / theme / milestone data
  scenario.ts        Scenario type + axes + resolveCatalogueIdentity()
  registry.ts        EmailSpecimen[] — one entry per email, with render(scenario)
  render.ts          server-only render dispatch (imports the real builders)
app/command/(protected)/emails/
  page.tsx           category list + scenario toolbar + render frame + identity strip
  EmailCatalogue.tsx client component (selection state, iframe, toolbar)
  actions.ts         "render this specimen under this scenario" server action
```

`EmailSpecimen`:
```ts
type EmailSpecimen = {
  id: string;                 // stable slug
  category: EmailCategory;    // client | agent | internal | solicitor | chain | platform
  name: string;               // human label
  description: string;        // one line: when it sends
  axes: ScenarioAxis[];       // which toolbar controls apply
  trigger: string;            // plain-English "fires when ..."
  render: (s: Scenario) => Promise<RenderedEmail>; // subject + html, real builder
};
type RenderedEmail = { subject: string; html: string };
```

The body HTML renders inside a sandboxed `<iframe srcdoc>` so email CSS is
isolated from the Command Centre chrome.

---

## The inventory (~45 specimens)

### Client (buyer/seller)
- Portal invite *(extract builder from `app/api/portal/invite/route.ts`)*
- Milestone update — single event (matrix; representative + code picker)
- Milestone digest (multi-step)
- Step confirmed (portal-confirm fallback)
- Progress update to other side (portal-confirm fallback)
- Ready to exchange
- Completion pack
- Client chase digest
- Client weekly update
- Comms visible-update
- Completion survey
- Exchange-day client — morning + authority
- Booking: survey/valuation reminder, confirmation, morning

### Agent (director/negotiator)
- Milestone agent notification
- Client-confirmed notification
- Portal message (client messaged the agent)
- Morning brief
- Weekly brief
- Team invite / team joined

### Internal (progressor / admin)
- Client-confirmed → progressor notification
- Manual "email from a file" (self-managed = agent's signature; outsourced =
  in-house block)

### Solicitor
- Confirm request / chase (digest)
- Enquiry reply chase
- Enquiry raise — buyer solicitor
- Quote request

### Chain
- Chain invite, chain overview, chain update, chain still-moving

### Platform / system
- Password reset, email verification, domain auth alert, agency invitation,
  retention (×6), first-exchange, invoice, content batch

---

## Build order

1. Fixtures + scenario + identity resolver.
2. Extract inline builders (portal invite first).
3. Registry + render adapters for the pure builders (most of the list).
4. Milestone matrix specimen (representative + code picker).
5. Page: list + toolbar + render frame + identity strip.
6. Nav entry in `CommandSidebar` + superadmin gate (inherited from the layout).
7. `tsc` + verify each specimen renders.

## Laws / constraints
- Law 8 (Command isolation): catalogue code lives under `lib/command/` +
  `app/command/`; it imports the real builders (shared utilities) but nothing
  imports it back.
- Law 9 (brand): the page uses the Command Centre visual system (dark `#0a0a0a`,
  hairline borders `#262626`, blue accent `#2563eb`, no glass). Rendered email
  bodies keep their own styling inside the iframe.
- Law 13 (no half-built): a specimen is listed only when its `render` works for
  real. Not-yet-wired emails are omitted, not shown as dead entries.
- Law 20: fixtures live in the catalogue module (synthetic, superadmin-only, not
  user-facing product copy).
