# Phase 0 — Retention Email System Discovery Report

Generated: 2026-05-01 (Retention email sequence task)

---

## 1. Where milestone emails are sent

**File:** `lib/email.ts`
**Function:** `sendEmail({ to, subject, text, html, from?, replyTo? })`
Uses `@sendgrid/mail`. Called throughout the codebase from service files.

There is also `lib/services/sendgrid.ts` which provides `sendFromVerifiedAddress` for agency-owned verified sender addresses (separate from the main system sender).

---

## 2. Email template system

Templates are **in code** — no DB storage, no seeding required. Each email template is a TypeScript object/function. Example pattern: `lib/services/morning-digest.ts` and `lib/services/client-weekly-update.ts` both build HTML inline at send-time.

No shared HTML wrapper function exists. Each service builds raw HTML inline. The email theme used by client-weekly-update and morning-digest is a plain white `#fff` background — NOT a cream/warm theme. The retention emails will need to build their own consistent wrapper. For Phase 2, we will create a reusable `buildRetentionEmailHtml()` wrapper that matches the style of the existing emails (white background, -apple-system sans-serif, max-width 560px, padding 32px 24px).

---

## 3. SendGrid sender setup

- **Verified sender domain / from-address:** `Sales Progressor <updates@thesalesprogressor.co.uk>`
  - Defined as `DEFAULT_FROM` constant in `lib/email.ts` line 5
- **Reply-to:** The `sendEmail` function accepts an optional `replyTo` parameter. Currently, no milestone emails set a reply-to — they inherit from-address as effective reply-to. We must pass `replyTo: "inbox@thesalesprogressor.co.uk"` explicitly.
- **No existing unsubscribe mechanism** in the codebase.

---

## 4. Recipient name resolution at send-time

**File:** `lib/contacts/displayName.ts`
Key export: `extractFirstName(name: string): string`
- Strips title prefixes (Mr, Mrs, Ms, Miss, Dr, etc.)
- Returns the first meaningful name word
- Falls back to "the contact"

Also: `lib/portal-copy.ts` exports `buildGreeting(name)` which formats "Hi {firstName}," with title awareness.

For retention emails, `User.name` is a single `String` field — we will use `extractFirstName(user.name)` for `{firstName}`.

---

## 5. Existing email HTML wrapper

No single shared wrapper function exists. Each service builds HTML inline. The two patterns are:
- `morning-digest.ts`: white bg (`#fff`), `-apple-system,sans-serif`, `max-width:560px`, `margin:0 auto`, `padding:32px 24px`
- `client-weekly-update.ts`: identical base style, same font stack

For retention emails, we will build a `buildRetentionHtml()` function in `lib/emails/retention/index.ts` that replicates this style. This is the correct approach — there is no existing shared wrapper to import.

---

## 6. `User.lastLoginAt` or equivalent

**Does NOT exist.** The `User` model has no `lastLoginAt`, `lastSeenAt`, or equivalent field. The `Session` model exists for NextAuth but is not populated in production (JWT strategy, credentials provider).

**Decision:** For retention email triggers, we use `User.createdAt` for the activation trigger, and `PropertyTransaction.createdAt` (most recent) as the proxy for "last activity". Documented in OPEN_QUESTIONS.md.

---

## 7. `PropertyTransaction.createdAt` and User relation

- `PropertyTransaction.createdAt DateTime @default(now())` ✓ (schema line 133)
- `PropertyTransaction.agentUserId String?` → `agentUser User? @relation("AgentFiles")` ✓
- `User.agentFiles PropertyTransaction[] @relation("AgentFiles")` ✓

We can query: "most recent transaction created by this user" via `agentUserId`.

---

## 8. `serviceMode` / equivalent field for send-to-us files

`PropertyTransaction` has:
- `serviceType ServiceType @default(self_managed)` — enum `{ self_managed | outsourced }`
- `progressedBy ProgressedBy @default(progressor)` — enum `{ progressor | agent }`

**There is no `serviceMode` field.** The closest equivalent is `serviceType`:
- `self_managed` = agent manages their own file through the platform
- `outsourced` = agency has contracted Sales Progressor to progress the file ("send to us")

For the `send_to_us_drop_21d` email, the trigger condition maps to: user has at least 1 transaction where `serviceType === "outsourced"`. Documented in OPEN_QUESTIONS.md.

---

## 9. Existing unsubscribe mechanism

**None.** No unsubscribe link, opt-out field, or preference centre exists in the codebase. Phase 4 adds the first unsubscribe mechanism via the new `User.retentionEmailOptOut` field and `/api/retention/unsubscribe` endpoint.

---

## 10. Scheduled cron jobs — `vercel.json` and entrypoint shape

**`vercel.json`** cron configuration (current):
```json
{
  "crons": [
    { "path": "/api/reminders/run",              "schedule": "0 7 * * *" },
    { "path": "/api/cron/morning-digest",         "schedule": "0 8 * * 1-5" },
    { "path": "/api/cron/agent-weekly-brief",     "schedule": "0 7 * * 1" },
    { "path": "/api/cron/client-weekly-update",   "schedule": "0 18 * * 0" },
    { "path": "/api/cron/check-domains",          "schedule": "0 2 * * *" },
    { "path": "/api/cron/detect-problems",        "schedule": "0 3 * * *" }
  ]
}
```

**Entrypoint shape** (from `app/api/cron/morning-digest/route.ts` and `app/api/reminders/run/route.ts`):
```typescript
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... call service function
  return NextResponse.json({ success: true, ...result });
}
```

New retention sweep cron will follow this pattern at `app/api/cron/retention-sweep/route.ts`.

---

## 11. `MilestoneCompletion` and user relation

- `MilestoneCompletion.completedById String?` → `completedBy User? @relation("CompletedBy")` ✓
- `User.milestoneCompletions MilestoneCompletion[] @relation("CompletedBy")` ✓

We can detect "zero milestone confirmations by this user on their transactions" by checking `MilestoneCompletion` count where `completedById = userId` AND `transactionId IN (user's transactions)`.

However, `stuck_day_3` trigger uses zero `MilestoneCompletion` rows on ANY of the user's transactions (not specifically confirmed by the user — state = complete counts regardless of who confirmed). This means checking `milestoneCompletions` on transactions owned by the agent (`agentUserId = userId`) where `state = "complete"`.

---

## Summary table

| Finding | Result |
|---------|--------|
| Email send function | `lib/email.ts` → `sendEmail()` |
| Template system | In-code (inline HTML) |
| From-address | `Sales Progressor <updates@thesalesprogressor.co.uk>` |
| Reply-to currently | Not set by milestone emails |
| First name helper | `extractFirstName()` in `lib/contacts/displayName.ts` |
| Shared HTML wrapper | None — must create in `lib/emails/retention/` |
| `User.lastLoginAt` | Does NOT exist |
| `PropertyTransaction.createdAt` | ✓ Exists |
| User→Transaction relation | `agentUserId` → `agentFiles` relation |
| `serviceMode` field | Does NOT exist; use `serviceType === "outsourced"` |
| Unsubscribe mechanism | None (adding in Phase 4) |
| Cron pattern | `GET` with `CRON_SECRET` bearer token check |
| `MilestoneCompletion.completedById` | ✓ Exists |

---

## Previous Phase 0 reports (preserved)

(See earlier sections below — relate to Activity Timeline / Hub Pipeline Health work, not this task.)
