# Pre-Launch Checklist

## Auth & Access

- [x] Password-based login via Credentials provider (bcryptjs, cost 12)
- [x] Role-aware redirect after login: negotiator → `/agent/dashboard`, all others → `/dashboard`
- [x] Root `/` redirects correctly per role (via `app/page.tsx` switch)
- [x] Middleware blocks negotiators from all internal routes (`/dashboard`, `/transactions`, `/admin`, etc.)
- [x] Middleware blocks non-negotiator/non-admin from `/agent` routes
- [x] Middleware redirects negotiator hitting `/transactions/[id]` into `/agent/transactions/[id]`
- [x] Agent layout double-checks role server-side (not just middleware)
- [x] Portal routes are public (no auth required), protected by `portalToken` on Contact
- [ ] Password reset flow (not built — set expectation with users)

## Role Separation

- [x] Internal users (admin, sales_progressor, viewer) never see agent nav
- [x] Agents never see AppShell sidebar, internal nav, or fee/commission fields
- [x] Agent transaction detail renders in agent shell (no AppShell)
- [x] Agent transaction page enforces ownership: `transaction.agentUserId === session.user.id`
- [x] Agents cannot access `/admin` routes (middleware blocks)
- [ ] Viewer role cannot mutate data (API-level — verify each POST/PATCH route checks role)

## Agent Portal

- [x] Agent dashboard shows only their own files (filtered by `agentUserId`)
- [x] Agent dashboard links go to `/agent/transactions/[id]` (basePath prop)
- [x] ForecastStrip links go to `/agent/transactions/[id]`
- [x] PostExchangeStrip links go to `/agent/transactions/[id]`
- [x] Agent can create new transactions at `/agent/transactions/new`
- [x] After creating, agent is redirected to `/agent/transactions/[id]`
- [x] "Send to progressor" sets `assignedUserId = null` (not agent's own ID)
- [x] "Self-progress" sets `assignedUserId = agentUserId = session.user.id`
- [x] Agent can flag files to progressor via `AgentFlagButton`

## Internal Dashboard

- [x] Dashboard shows all agency transactions (no agent filter)
- [x] TransactionTable links go to `/transactions/[id]` (default basePath)
- [x] New transaction form redirects to `/transactions/[id]` after creation
- [x] Status control, assigned-to field, and fee fields only visible to internal users

## Buyer/Seller Portal

- [x] Portal entry at `/portal/[token]` — no auth required
- [x] Renders read-only view scoped to the contact's transaction
- [ ] Multi-transaction portal selection page (if one contact has multiple tokens)

## Data & Seeding

- [x] All 5 test users have hashed passwords (bcrypt, `Hartwell2024!`)
- [x] Emily (negotiator) has transactions via `agentUserId` so they appear on agent dashboard
- [x] Milestone definitions seeded: 20 vendor, 27 purchaser
- [x] Reminder rules seeded: 47 rules
- [x] Seed runs against DIRECT_URL (Supabase pooler drops long connections)

## Test Accounts

| Email | Role | Expected destination after login |
|---|---|---|
| admin@hartwell.com | admin | /dashboard |
| sarah@hartwell.com | sales_progressor | /dashboard |
| james@hartwell.com | sales_progressor | /dashboard |
| tom@hartwell.com | viewer | /dashboard |
| emily@hartwell.com | negotiator | /agent/dashboard |

Password for all accounts: `Hartwell2024!`

See `docs/test-accounts.md` for full testing flows.

## Production Deployment (Vercel)

- [ ] Set all env vars in Vercel project settings:
  - `DATABASE_URL` — Supabase pooler URL
  - `DIRECT_URL` — Supabase direct URL
  - `NEXTAUTH_SECRET` — strong random string
  - `NEXTAUTH_URL` — production URL (e.g. `https://your-app.vercel.app`)
- [ ] Run `prisma migrate deploy` (or `db push`) against production DB before first deploy
- [ ] Run seed against production DB if demo data is needed
- [ ] Confirm `NEXTAUTH_URL` matches the actual deployed domain exactly
- [ ] Test login end-to-end on production URL (not localhost)
- [ ] Confirm portal token links work from production URL

## Known Gaps (Post-Launch)

- Password reset / forgot password flow
- Multi-transaction portal selection page for contacts with multiple files
- Email notifications (chase tasks, reminder triggers)
- Viewer role mutation guards (API layer)
