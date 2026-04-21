# Sales Progressor — Sprint 1

Transaction management platform for residential property sales.

---

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma** + **PostgreSQL**
- **NextAuth.js** (credentials, JWT strategy)

---

## Requirements

- Node.js 18+
- A running PostgreSQL instance (local or hosted)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/sales_progressor"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
DEV_AUTH_BYPASS="true"
```

> **Tip:** Generate a secret with `openssl rand -base64 32`

### 3. Create the database

Make sure PostgreSQL is running and the database exists:

```bash
createdb sales_progressor
# or via psql: CREATE DATABASE sales_progressor;
```

### 4. Run migrations

```bash
npm run db:migrate
```

When prompted, give the migration a name like `sprint1_foundation`.

### 5. Seed demo data

```bash
npm run db:seed
```

This creates:
- **Agency:** Hartwell & Partners
- **Users:** Sarah Hartwell (admin), James Okafor (sales_progressor), Emily Chen (negotiator)
- **Transactions:** 4 demo transactions at various statuses
- **Contacts:** Multiple contacts across the transactions

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Signing in (Dev bypass)

With `DEV_AUTH_BYPASS=true`, enter any seeded email — no password required:

| Email | Role |
|-------|------|
| sarah@hartwellpartners.co.uk | Admin |
| james@hartwellpartners.co.uk | Sales Progressor |
| emily@hartwellpartners.co.uk | Negotiator |

> **⚠️ Remove `DEV_AUTH_BYPASS` before any production deployment.**

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Import into [Vercel](https://vercel.com)
3. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL` (use a hosted Postgres — Vercel Postgres, Supabase, Neon, etc.)
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (your production URL, e.g. `https://yourapp.vercel.app`)
   - Do **not** set `DEV_AUTH_BYPASS` in production
4. After first deploy, run migrations from your local machine against the production DB:
   ```bash
   DATABASE_URL="<production-url>" npx prisma migrate deploy
   DATABASE_URL="<production-url>" npm run db:seed
   ```

---

## Project structure

```
app/
  api/
    auth/[...nextauth]/   NextAuth handler
    contacts/             Contact CRUD
    transactions/         Transaction CRUD
  dashboard/              Dashboard page
  login/                  Login page
  transactions/
    new/                  Create transaction
    [id]/                 Transaction detail
  globals.css
  layout.tsx
  page.tsx                Redirects to /dashboard or /login

components/
  contacts/
    ContactsSection.tsx   Add/list/remove contacts
  layout/
    AppShell.tsx          Sidebar + main layout
    LoginForm.tsx         Login form (client)
    SessionProvider.tsx   NextAuth provider wrapper
    SignOutButton.tsx      Sign out (client)
  ui/
    EmptyState.tsx
    PageHeader.tsx
    StatusBadge.tsx

lib/
  auth.ts                 NextAuth config + dev bypass
  prisma.ts               Prisma singleton
  session.ts              requireSession / getSession helpers
  utils.ts                Formatting, labels, constants
  services/
    contacts.ts           Contact DB access (agency-scoped)
    transactions.ts       Transaction DB access (agency-scoped)
    users.ts              User queries

prisma/
  schema.prisma           Data model
  seed.ts                 Demo data
```

---

## What's not built yet (future sprints)

- Sprint 2: Milestone Definitions + Milestone Completions (vendor/purchaser/agent sides)
- Sprint 3: Reminder Rules, Reminder Logs, Chase Tasks
- Sprint 4: Exchange gating, time-sensitive milestones
- Sprint 5: Comms, forecasting
- Sprint 6: AI layer

---

## Useful commands

```bash
npm run db:studio     # Open Prisma Studio (visual DB browser)
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:push       # Push schema changes without migration (dev only)
npm run lint          # ESLint
```
