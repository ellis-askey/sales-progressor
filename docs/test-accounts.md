# Test Accounts & Testing Guide

> **STAGING-ONLY ACCOUNTS. PASSWORDS LIVE IN ELLIS'S PASSWORD MANAGER, NOT THIS REPO.**
>
> The GitHub repo is **public**. Putting passwords in a public repo is unsafe even for staging — anyone reading git history would have working credentials to a publicly-reachable deploy that contains real-looking client data. This file used to carry passwords directly; it no longer does.
>
> Last re-rotation: **2026-06-04** (second rotation of the day after the public-repo finding — the values committed earlier in `7628d83` are now invalid and have been added to `KNOWN_WEAK_PASSWORDS` in [scripts/prod-check-weak-credentials.ts](../scripts/prod-check-weak-credentials.ts) so the prod gate catches them if they ever reappear).

## How to get a working password

Ellis maintains the current staging passwords in his password manager under "Sales Progressor — staging test accounts". Ask him.

If you need to rotate (re-seed, suspected leak, periodic refresh):

```bash
npx -y dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/rotate-staging-test-passwords.ts
```

The rotation script:

- Refuses to run if `DATABASE_URL` points at production.
- Only rotates emails on an explicit allowlist (no real users touched).
- Prints the new passwords to stdout for you to paste into the password manager.
- **Do NOT paste the printed passwords into this file, into a commit, into Slack, into anywhere version-controlled or chat-archived.** Password manager only.

After every rotation, the previous values get appended to `KNOWN_WEAK_PASSWORDS` in [scripts/prod-check-weak-credentials.ts](../scripts/prod-check-weak-credentials.ts) so the prod gate keeps catching them if they ever reappear. That's a maintenance step — see the comment in that file.

---

## Setup

Before testing, run the seed to create all test data:

```bash
npx prisma db push       # applies any pending schema changes
npm run db:seed          # wipes and recreates all test data
```

If you re-seed, you'll need to re-run the password rotation (above) and update the password manager entry.

---

## Test Accounts (staging only)

| Email | Role | Lands on |
|---|---|---|
| `ellisaskey@googlemail.com` | Admin | `/dashboard` |
| `ellis@thesalesprogressor.co.uk` | Sales Progressor | `/dashboard` |
| `emily@hartwellpartners.co.uk` | Director | `/agent/dashboard` |
| `alex@hartwellpartners.co.uk` | Director | `/agent/dashboard` |

`sarah@hartwellpartners.co.uk` and `james@hartwellpartners.co.uk` were listed in pre-2026-06-04 versions of this file but do not exist on the current staging seed.

---

## Dedicated Playwright account (rotation-excluded)

| Email | Role | Owner |
|---|---|---|
| `playwright-bot@hartwellpartners.co.uk` | Director (Hartwell & Partners) | Verification suite only |

Created 2026-06-04. The visual verification suite (`scripts/verify-8-playwright.ts`) used to log in as a shared seed account; coupling a verification tool to a rotated seed and then letting that tool write back to fix the resulting failures is the failure mode this account exists to eliminate.

**Incident closure (2026-06-04):** during the same session a "rotation cron rewriting Emily's password" was reported. Investigation found no unidentified process. Root causes: (1) a single manual run of `scripts/rotate-staging-test-passwords.ts` earlier the same day in response to the public-repo finding, (2) the auth rate limiter (`checkAuthLimit` in [lib/auth.ts](../lib/auth.ts)) returning null on repeated failed logins from the suite's IP, which presents identically to "wrong password". A temporary workaround that had the suite reset Emily's password in-process compounded the apparent symptom by generating real `updatedAt` churn. Incident closed; no unidentified writer exists.

Rules (LOCKED policy — this account's password is set ONCE and is permanent):

- The password is **set once**, by Ellis, with a value he stores in the password manager under **"Sales Progressor — staging test accounts → playwright-bot"**. It is **never rotated**.
- The verification suite reads the password from the `PLAYWRIGHT_TEST_PASSWORD` env var (and `PLAYWRIGHT_TEST_EMAIL`, defaulting to `playwright-bot@hartwellpartners.co.uk`). The suite NEVER writes to the User table — the dedicated-account pattern only works if the suite is read-only against credentials.
- The account is on a HARD BLOCKLIST in [scripts/rotate-staging-test-passwords.ts](../scripts/rotate-staging-test-passwords.ts) — if anyone ever adds it to `TEST_ACCOUNT_EMAILS`, the rotation script aborts before writing anything. Do not remove that blocklist entry.
- One-time provisioning command (the only time `scripts/ensure-playwright-test-user.ts` ever runs against this account):
  ```bash
  PLAYWRIGHT_TEST_PASSWORD=<value-from-password-manager> \
    npx -y dotenv -e .env --override -- npx ts-node \
    --project tsconfig.scripts.json scripts/ensure-playwright-test-user.ts
  ```
  The script refuses to run against production, refuses passwords <24 chars, and refuses any value on the known-weak list. After this single run, password admin for this account is over, forever.

---

## Core Flows to Test

### 1. Internal admin / progressor login
1. Go to `/login`
2. Sign in as `ellisaskey@googlemail.com` (password from manager)
3. Should land on `/dashboard` — full internal sidebar visible
4. Confirm: Admin link appears in nav (admin only)
5. Try navigating to `/agent/dashboard` — should be redirected to `/dashboard`

### 2. Agent login
1. Sign out (click Sign out in sidebar or header)
2. Go to `/login`
3. Sign in as `emily@hartwellpartners.co.uk` (password from manager)
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
3. Click "New Transaction"
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

- Portal multi-transaction: each contact has one portal token pointing to one transaction. If the same buyer is on multiple transactions, they receive separate links.
- Password reset: no forgot password flow yet — reset must be done via Prisma Studio or a manual DB update.
- Email verification: registration creates accounts immediately without email confirmation.
