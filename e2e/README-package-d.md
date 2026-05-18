# Package D + WS2 — Test Suite

## Run

```bash
# Full suite
npx playwright test e2e/package-d-and-ws2.spec.ts

# npm shortcut (add to package.json if desired)
npm run test:package-d
```

Requires the dev server running on `localhost:3000`:
```bash
npm run dev
```

---

## Credential Setup

1. Copy `.env.test.example` to `.env.test` at the repo root:
   ```bash
   cp .env.test.example .env.test
   ```

2. Fill in the values:

   ```
   TEST_PASSWORD=<shared password for admin + progressor accounts>
   TEST_DIRECTOR_PASSWORD=<director account password>
   TEST_PROGRESSOR_ZERO_PASSWORD=password   # already seeded with this password
   ```

3. Optional accounts (their tests skip if the env var is empty):
   - `TEST_SUPERADMIN_EMAIL` / `TEST_SUPERADMIN_PASSWORD` — enables WS2-6
   - `TEST_NEGOTIATOR_EMAIL` / `TEST_NEGOTIATOR_PASSWORD` — enables negotiator variants of PD-8/9

`.env.test` is gitignored. Never commit it.

---

## Test Accounts Required

| Account | Email | Role | Cases |
|---|---|---|---|
| Admin (Ellis) | `ellisaskey@googlemail.com` | admin | PD-1/2, WS2-2/4/7 |
| Sales Progressor with files | `ellis@thesalesprogressor.co.uk` | sales_progressor | PD-3/4, WS2-1/3 |
| Sales Progressor zero files | `ellis+zero@thesalesprogressor.co.uk` | sales_progressor | PD-5/6 |
| Director | `taylor@akeman-residential.co.uk` | director | PD-8/9, WS2-5 |
| Negotiator | *(set `TEST_NEGOTIATOR_EMAIL`)* | negotiator | PD-8/9, WS2-5b |
| Superadmin | *(set `TEST_SUPERADMIN_EMAIL`)* | superadmin | WS2-6 |

Admin and Sales Progressor accounts share `TEST_PASSWORD`.
Director uses `TEST_DIRECTOR_PASSWORD` (falls back to `TEST_PASSWORD` if not set).
Zero-file progressor uses `TEST_PROGRESSOR_ZERO_PASSWORD` (default: `password`).

---

## Seeding the Zero-File Progressor Account

The `ellis+zero@thesalesprogressor.co.uk` account was seeded with:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-test-accounts.ts
```

Script is idempotent — safe to re-run. If the account already exists it skips creation.

---

## Cases That Skip and Why

| Case | Status | Reason |
|---|---|---|
| PD-7 | PERMANENT SKIP | Admin has `scope: "all"` globally — can't isolate to a zero-outsourced agency on production. Verify manually on a clean test agency. |
| WS2-6 | SKIP if not configured | Set `TEST_SUPERADMIN_EMAIL` + `TEST_SUPERADMIN_PASSWORD` in `.env.test` to enable. Verify manually: superadmin login → should land on `/command/overview`, not `/agent/hub`. |
| WS2-5b / PD-8/9 negotiator | SKIP if not configured | Set `TEST_NEGOTIATOR_EMAIL` + `TEST_NEGOTIATOR_PASSWORD` in `.env.test` to enable. |

PD-5 and PD-6 are now enabled (zero-file progressor account seeded).

---

## Screenshot Privacy

**Screenshots contain real production data: customer file addresses, names, fees.**

- `e2e/screenshots/` is gitignored — files stay local on the runner only
- Do not share screenshots externally without redacting PII first
- Do not upload to CI artefact stores unless specifically anonymised

Screenshots land in `e2e/screenshots/package-d-ws2/`. Created automatically on first run.

| File | What it shows |
|---|---|
| `package-d-case-1-admin-dashboard.png` | Admin on /agent/hub with forecast + post-exchange strips |
| `package-d-case-2-admin-completing.png` | Admin on /completing with grouped files |
| `package-d-case-3-progressor-dashboard.png` | Progressor on /agent/hub (scoped to their files) |
| `package-d-case-4-progressor-completing.png` | Progressor on /completing (scoped) |
| `package-d-case-5-zero-progressor-hub.png` | Zero-file progressor on /agent/hub — empty state |
| `package-d-case-6-zero-progressor-completing.png` | Zero-file progressor on /completing — empty state |
| `package-d-case-8-{director\|negotiator}-transactions.png` | Agent transaction list |
| `package-d-case-9-{director\|negotiator}-tab-{name}.png` | Agent transaction detail per tab |
| `ws2-case-1-progressor-lands-agent-hub.png` | Progressor post-login URL = /agent/hub |
| `ws2-case-2-admin-lands-agent-hub.png` | Admin post-login URL = /agent/hub |
| `ws2-case-7-dashboard-direct-url.png` | /dashboard still accessible via direct URL |

---

## Human Walkthrough Required (after automation passes)

Cases PD-8 and PD-9 are partially covered by automation (load, tab clicks, no console errors). The remaining agent-UX guarantee must be verified by eye:

- Log in as director. Navigate to `/agent/transactions`. Verify the list looks and behaves exactly as before Package D: sorting, filter chips, row layout, forecast strip, hover states.
- Click into any transaction. Walk all 5 tabs (Overview, Milestones, Reminders, To-Do, Activity). Verify each renders correctly, no visual regressions.
- Repeat as negotiator.
- Confirm no animation timing changes, no hover difference, no colour/spacing shifts.

Estimated time: 10 minutes.

Automation is the gate. Human walkthrough is the final confidence check.

---

## No-Mutations Contract

Every test in this suite is read-only. Tests log in, navigate, assert render, and screenshot — nothing else.

**Tests must never:**
- Click "Confirm" on milestones
- Click "Mark complete" on chase tasks
- Click "Save" on any form
- Trigger any server action

If a test fails because it needed to mutate state to verify something, the test design is wrong — not the app.
