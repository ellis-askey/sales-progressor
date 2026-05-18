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

Environment: copy `.env` to `.env.test.local` (or ensure `TEST_PASSWORD` is set).

---

## Test Accounts Required

| Account | Email | Role | Cases |
|---|---|---|---|
| Admin (Ellis) | `ellisaskey@googlemail.com` | admin | PD-1/2, WS2-2/4/7 |
| Sales Progressor with files | `james@hartwellpartners.co.uk` | sales_progressor | PD-3/4, WS2-1/3 |
| Director | `rachel@whitfieldhunt.co.uk` | director | PD-8/9, WS2-5 |
| Negotiator | `tom@whitfieldhunt.co.uk` | negotiator | PD-8/9, WS2-5 |

All share the same password (`TEST_PASSWORD` env var, default `Hartwell2024!`).

---

## Cases That Skip and Why

| Case | Status | Reason |
|---|---|---|
| PD-5 | SKIP | No zero-files sales_progressor account seeded. Create one with no `assignedUserId` files and set `USERS.progressorZeroFiles` in `e2e/helpers.ts`. |
| PD-6 | SKIP | Same as PD-5. |
| PD-7 | SKIP | Requires an agency whose outsourced files are all pre-completion (none post-exchange). Set up manually and test against that admin account. |
| WS2-6 | SKIP | No superadmin test account. Verify manually: superadmin login → should land on `/command/overview`, not `/agent/hub`. |

---

## To enable PD-5 and PD-6

1. Create a sales_progressor account in the test DB with no assigned transactions.
2. Set their email in `e2e/helpers.ts`:
   ```ts
   progressorZeroFiles: "zero-progressor@example.com",
   ```
3. Re-run the suite — Cases 5 and 6 will no longer skip.

---

## Screenshot Locations

All screenshots land in `e2e/screenshots/package-d-ws2/`. Created automatically on first run.

| File | What it shows |
|---|---|
| `package-d-case-1-admin-dashboard.png` | Admin on /dashboard with forecast + post-exchange strips |
| `package-d-case-2-admin-completing.png` | Admin on /completing with grouped files |
| `package-d-case-3-progressor-dashboard.png` | Progressor on /dashboard (scoped to their files) |
| `package-d-case-4-progressor-completing.png` | Progressor on /completing (scoped) |
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
