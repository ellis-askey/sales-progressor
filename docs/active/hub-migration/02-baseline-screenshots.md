# Baseline screenshots — capture before any code

**Owner:** Ellis (manual capture)
**Where they go:** `docs/active/hub-migration/baseline/` (create folder + drop PNGs)
**Purpose:** the "before" evidence. Every screenshot here must have a matching "after" screenshot from `/agent/hub-preview` before sign-off.

## Naming convention

`{role}--{state}--{viewport}.png`

Examples:
- `director--populated--desktop.png`
- `director--empty--mobile.png`
- `sales_progressor--populated--desktop.png`

Viewports: `desktop` = 1280 wide, `mobile` = 375 wide. Chrome dev-tools device toolbar.

---

## Capture list

### Director view (Emily @ Hartwell)

Login: `emily@hartwellpartners.co.uk`

- [ ] `director--populated--desktop.png` — the default hub with pipeline, attention items, wins etc.
- [ ] `director--populated--mobile.png` — same at 375px
- [ ] `director--populated--scrolled-halfway--desktop.png` — mid-scroll so we see the middle sections
- [ ] `director--populated--scrolled-bottom--desktop.png` — bottom of the hub
- [ ] `director--empty--desktop.png` — a fresh director account with zero files (create test user if needed, or seed one)
- [ ] `director--empty--mobile.png`

### Negotiator view

If Hartwell has a negotiator account, log in as them. If not, this is a fixture gap — mark and move on.

- [ ] `negotiator--populated--desktop.png`
- [ ] `negotiator--populated--mobile.png`

### Sales progressor view (internal staff, agencyId=null)

Login: `ellis@thesalesprogressor.co.uk`

- [ ] `sales_progressor--populated--desktop.png` — files assigned to Ellis
- [ ] `sales_progressor--populated--mobile.png`
- [ ] `sales_progressor--unassigned-visible--desktop.png` — the unassigned files widget populated
- [ ] `sales_progressor--empty--desktop.png` — sales progressor with no assigned files

### Admin / superadmin view

Login: `ellisaskey@googlemail.com`

- [ ] `admin--populated--desktop.png` — cross-agency view
- [ ] `admin--populated--mobile.png`
- [ ] `admin--platform-wide-subtitle--desktop.png` — confirm subtitle says "across the platform"

### Niche states (with populated hub)

- [ ] `director--payment-block-banner--desktop.png` — PaymentBlockBanner top of page (if a fixture exists in this state)
- [ ] `director--payment-method-nudge--desktop.png` — PaymentMethodNudge (billing exists but no method)
- [ ] `director--expired-holds-populated--desktop.png` — expired holds card shows entries
- [ ] `director--chain-decline-notification--desktop.png` — chain decline widget (if fixture)
- [ ] `director--relist-to-acknowledge--desktop.png` — the relist ack widget populated
- [ ] `director--chain-setup-pending--desktop.png`
- [ ] `director--all-service-outsourced--desktop.png` — donut skews fully outsourced
- [ ] `director--all-service-self-managed--desktop.png`

### Interactive states (capture the visible UI after)

- [ ] `director--attention-hover--desktop.png` — hover over a file card
- [ ] `director--attention-detail-drawer-open--desktop.png` — click an attention item, whatever drawer opens

---

## What to do if a capture is impossible

If a state can't be captured because no fixture exists, note it in [03-fixtures.md](03-fixtures.md) with a "seed needed" flag. Do NOT skip and forget — an un-capturable state is a state we can't verify later.

## When done

Update the README's Phase 1 exit checklist and ping Ellis for the sign-off to move to Phase 2.
