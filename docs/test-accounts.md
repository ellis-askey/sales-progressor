# Test Accounts & Testing Guide

> **STAGING-ONLY CREDENTIALS.** Every password below is for the staging Supabase project (`etidawkbqctarmsdjoxp.supabase.co`). Production has no test accounts (enforced by runbook checks at deploy time — see `docs/active/relist-feature/prod-release-runbook.md`).
>
> Rotated 2026-06-04 from the previous weak `password` / `Hartwell2024!` defaults after a security finding (staging deploy is publicly reachable and contains real-looking client data). Rotation script: [scripts/rotate-staging-test-passwords.ts](../scripts/rotate-staging-test-passwords.ts).

## Setup

Before testing, run the seed to create all test data:

```bash
npx prisma db push       # applies any pending schema changes
npm run db:seed          # wipes and recreates all test data
```

If you re-seed, you'll need to re-run the password rotation:

```bash
npx -y dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/rotate-staging-test-passwords.ts
# Then paste the rotated rows into the table below.
```

---

## Test Accounts (staging only — rotated 2026-06-04)

| Email | Password | Role | Lands on |
|---|---|---|---|
| `ellisaskey@googlemail.com` | `Sy6BzWF7YKZJ1MwCMb3Vit8I2og8M7Uy` | Admin | `/dashboard` |
| `ellis@thesalesprogressor.co.uk` | `6-dwN72_5McVTb64wbIKmp3hIb-bALWF` | Sales Progressor | `/dashboard` |
| `emily@hartwellpartners.co.uk` | `BjKcA9LOdqYMRpToNRB2WDKT_IJatuKW` | Director | `/agent/dashboard` |
| `alex@hartwellpartners.co.uk` | `-1xgyS74w0hUifgpsvJXzxt9DxM8XSNg` | Director | `/agent/dashboard` |

`sarah@hartwellpartners.co.uk` and `james@hartwellpartners.co.uk` were listed in the previous version of this file but do not exist on the current staging seed. If a future seed adds them, re-run the rotation script and update this table.

---

## Core Flows to Test

### 1. Internal admin / progressor login
1. Go to `/login`
2. Sign in as `ellisaskey@googlemail.com`
3. Should land on `/dashboard` — full internal sidebar visible
4. Confirm: Admin link appears in nav (admin only)
5. Try navigating to `/agent/dashboard` — should be redirected to `/dashboard`

### 2. Agent login
1. Sign out (click Sign out in sidebar or header)
2. Go to `/login`
3. Sign in as `emily@hartwellpartners.co.uk`
4. Should land on `/agent/dashboard` — agent nav header only
5. Confirm: only shows emily's files (filtered by agentUserId)
6. Try navigating to `/dashboard` — should be redirected to `/agent/dashboard`
7. Try navigating to `/admin` — should be redirected to `/agent/dashboard`

### 3. Agent self-registration
1. Go to `/register`
2. Fill in: name, work email, password (8+ chars), confirm password, agency name
3. Accept terms checkbox
4. Submit — should create account and sign in immediately
5. Should land on `/agent/dashboard`

### 4. Create a new transaction (as internal user)
1. Sign in as ellis (admin/progressor)
2. Click "New Transaction" in sidebar
3. Fill in property address, purchase price, tenure, purchase type
4. Submit — should appear in `/dashboard`

### 5. Create a transaction as an agent
1. Sign in as emily (director)
2. Go to `/agent/dashboard`
3. Click "New Transaction" (or find the new transaction button)
4. Should see "who progresses this?" choice: Send to progressor / Self-progress
5. Submit — file should appear in correct dashboard

### 6. Portal access (buyer/seller)
Portal tokens are generated per-contact when a transaction is created and contacts are added.

To find a portal token:
- In Prisma Studio (`npm run db:studio`) → Contact table → find a contact with a portalToken
- Navigate to `/portal/[token]`
- Should show property overview, progress tracker, and updates

### 7. Role separation verification
| User | Can access | Cannot access |
|---|---|---|
| Admin | `/dashboard`, `/agent/*`, `/admin` | — |
| Sales Progressor | `/dashboard` | `/agent/*`, `/admin` |
| Negotiator | `/agent/*`, `/transactions/*` | `/dashboard`, `/tasks`, `/admin` |
| Director | `/agent/*` | `/dashboard`, `/admin` |
| Viewer | `/dashboard` (read-only) | `/agent/*`, `/admin` |

---

## Known Limitations (post-seed)

- Portal multi-transaction: each contact has one portal token pointing to one transaction. If the same buyer is on multiple transactions, they receive separate links. A unified "my transactions" portal page is not yet built.
- Password reset: no forgot password flow yet — reset must be done via Prisma Studio or a manual DB update.
- Email verification: registration creates accounts immediately without email confirmation.
