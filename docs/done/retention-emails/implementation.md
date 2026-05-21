# Retention Email Sequence — Implementation Report

Completed: 2026-05-01

---

## Summary

Six-email retention sequence implemented across five phases. All phases passed `npx next build` (exit 0) and `npx tsc --noEmit` (exit 0). The `npm run lint` command resolves to `next lint` which fails due to a worktree/workspace path issue unrelated to this implementation (pre-existing condition documented in earlier Phase 0 report). TypeScript is the authoritative check used throughout.

---

## Files Changed

### New files

| File | Purpose |
|------|---------|
| `lib/emails/retention/index.ts` | Six email template functions + registry |
| `lib/services/retention.ts` | `maybeFireFirstExchangeEmail`, `runRetentionEmailSweep`, `generateUnsubscribeUrl`, `verifyToken` |
| `app/api/cron/retention-sweep/route.ts` | Daily cron route (09:00 UTC) |
| `app/api/retention/unsubscribe/route.ts` | GET unsubscribe endpoint |
| `prisma/migrations/retention_email_log.sql` | Migration SQL for Supabase SQL editor |
| `PHASE_0_REPORT.md` | Updated with retention-system discovery findings |
| `OPEN_QUESTIONS.md` | OQ-8, OQ-9, OQ-10 added |

### Modified files

| File | Change |
|------|---------|
| `prisma/schema.prisma` | Added `retentionEmailOptOut Boolean @default(false)` to User; added `retentionEmailLogs RetentionEmailLog[]` relation; added `RetentionEmailLog` model |
| `app/actions/milestones.ts` | Added import of `maybeFireFirstExchangeEmail`; added fire-and-forget call after VM19/PM26 confirmation |
| `vercel.json` | Added `/api/cron/retention-sweep` at `"0 9 * * *"` |

---

## New schema fields

| Model | Field | Type | Notes |
|-------|-------|------|-------|
| `User` | `retentionEmailOptOut` | `Boolean @default(false)` | Opt-out for emails 4, 5, 6 only |
| `RetentionEmailLog` | `id` | `String @id @default(cuid())` | |
| `RetentionEmailLog` | `userId` | `String` | FK to User, CASCADE delete |
| `RetentionEmailLog` | `emailKey` | `String` | One of the six email key constants |
| `RetentionEmailLog` | `sentAt` | `DateTime @default(now())` | |
| `RetentionEmailLog` | `agencyId` | `String` | Agency scoping |

Indexes: `[userId, emailKey]`, `[agencyId, sentAt]`, `[emailKey, sentAt]`

---

## Migration SQL location

`prisma/migrations/retention_email_log.sql`

Apply via Supabase SQL editor. Do NOT run `prisma migrate` — this project uses Supabase for migrations.

---

## Email keys and behaviour

| Email key | Trigger | Opt-out respected | Unsubscribe footer |
|-----------|---------|-------------------|-------------------|
| `activation_day_1` | Zero transactions, account 1+ days old | No (transactional) | No |
| `stuck_day_3` | Transaction exists 3+ days, zero milestones complete | No (transactional) | No |
| `first_exchange` | VM19 or PM26 confirmed | No (transactional) | No |
| `quiet_30d` | 3+ transactions, most recent 30+ days ago | Yes | Yes |
| `send_to_us_drop_21d` | Has outsourced file, most recent 21+ days ago | Yes | Yes |
| `last_touch_60d` | Most recent 60+ days ago + prior quiet/send-to-us email | Yes | Yes |

All emails: from `updates@thesalesprogressor.co.uk`, reply-to `inbox@thesalesprogressor.co.uk`.
Email 5 only: sender display name `Rachel — Sales Progressor`.
All others: sender display name `Sales Progressor`.

---

## `serviceMode` field mapping

The spec references `serviceMode === "send_to_us"`. No such field exists. Mapped to `serviceType === "outsourced"` (existing enum on `PropertyTransaction`). See `OPEN_QUESTIONS.md` OQ-8.

---

## TODOs left

1. **Admin dashboard for retention logs** — indexes are in place; surface is a future ticket. Comment in schema: `// TODO: surface in admin dashboard — see future-admin-page ticket`
2. **Apply migration SQL** — `prisma/migrations/retention_email_log.sql` must be run in Supabase SQL editor before the feature is live.
3. **`NEXTAUTH_URL` env var** — `generateUnsubscribeUrl` and CTA URLs depend on `process.env.NEXTAUTH_URL`. Ensure this is set in production.

---

## Reference

See `OPEN_QUESTIONS.md` for:
- OQ-8: `serviceMode` → `serviceType` mapping (IRREVERSIBLE)
- OQ-9: `lastLoginAt` does not exist, using `createdAt` proxy (REVERSIBLE)
- OQ-10: `stuck_day_3` uses transaction-level completions (REVERSIBLE)

---

## Verification checklist (Phase 5)

- [x] `maybeFireFirstExchangeEmail` called in `app/actions/milestones.ts` after VM19/PM26 commits (line 173)
- [x] Emails 4, 5, 6 templates include unsubscribe footer — confirmed in `lib/emails/retention/index.ts`
- [x] Emails 1, 2, 3 templates do NOT include unsubscribe footer
- [x] Email 5 (`send_to_us_drop_21d`) uses "Rachel — Sales Progressor" as sender and has NO CTA button
- [x] All six templates use the same `buildHtmlWrapper()` function in `lib/emails/retention/index.ts`
- [x] `RetentionEmailLog` row written after `sendEmail()` succeeds, NOT on failure (in `sendRetentionEmail()` — `create` is after `sendEmail`)
- [x] Cron route at `app/api/cron/retention-sweep/route.ts` ✓
- [x] Registered in `vercel.json` at `"0 9 * * *"` ✓
- [x] `npx next build` — exit 0 ✓
- [x] `npx tsc --noEmit` — exit 0 ✓

---

## Previous report content (Pipeline Health Additions — 2026-05-01)

(Preserved below for reference)

### Files Changed

| File | Change |
|---|---|
| `lib/services/hub.ts` | Added `getHubPipelineStats`, `getHubRetentionStats`, `getHubStallStats`, `exchangingThisWeek` |
| `app/agent/hub/page.tsx` | Rendered new hub metrics cards |
| `components/milestones/MilestoneRow.tsx` | Post-confirm notification pills overlay |
| `components/transaction/NextMilestoneWidget.tsx` | Updated milestone widget |
| `app/actions/milestones.ts` | Return `notifications` array from `confirmMilestoneAction` |
