# ADMIN_00 — Discovery Prompt for Claude Code

**Purpose:** Before any command centre work is designed in detail, we need a map of the current state. Paste this entire prompt into Claude Code (in the repo root). Save the report it produces as `ADMIN_00_DISCOVERY_REPORT.md` and share it back so docs 02 (data model) and 03 (metrics catalogue) can be finalised against reality, not assumption.

**Do not implement anything from this prompt. It is a read-only investigation.**

---

## Prompt to paste into Claude Code

> I'm about to design an internal command centre for this app. Before I write the spec, I need you to investigate the current codebase and produce a discovery report. Do not modify any code. Read only.
>
> Produce a markdown report covering the following sections in order. For each section, cite the exact file paths and line numbers you read, and quote the relevant code (short snippets only). If something doesn't exist, say so explicitly — don't guess.
>
> ### Section 1 — Self-progressed vs progressor-managed distinction
>
> The product has two operating modes: (a) "self-progressed" where the agency runs their own progression using the agent portal, and (b) "progressor-managed" where our internal sales progressor team handles it on the agency's behalf.
>
> Find out:
> - Is there an explicit field on `Agency`, `User`, or `PropertyTransaction` that distinguishes these? Check the Prisma schema first.
> - If not explicit, is it implicit anywhere? (e.g. agencies belonging to a particular parent, transactions assigned to internal users vs agency users, a `source` or `origin` column, anything similar)
> - Does the `User` table have a way to mark someone as an internal sales progressor vs an agency user? (Look at `role` enum values and any agency linkage.)
> - Does the agent portal have any signal that distinguishes a self-progressed agency user from a progressor-managed agency user?
>
> Conclude: is the distinction (1) already cleanly modelled, (2) implicit and derivable, or (3) entirely absent and needs to be added?
>
> ### Section 2 — Existing audit / activity / event logging
>
> List every table or mechanism that records "something happened":
> - Prisma models with names like `Event`, `AuditLog`, `Activity`, `*Log`, `*History`
> - `createdAt` / `updatedAt` patterns and which models have them
> - Any append-only tables
> - Any logging to external services (search for `console.log`, structured loggers, anything sending to a logging endpoint)
>
> For each, note: what fires writes to it, what columns it captures, and whether it's queryable for analytics (i.e. has the indexes that would make time-series queries fast).
>
> ### Section 3 — Outbound communications inventory
>
> The command centre needs to show every outbound message ever sent. Map what exists today:
> - `CommunicationRecord` table: full schema, what writes to it, what fields are populated, whether AI-generated messages are flagged
> - SendGrid integration: where is `@sendgrid/mail` called from? Is the send recorded anywhere before/after the API call?
> - Any SMS, WhatsApp, or other outbound channel code (search for `twilio`, `whatsapp`, `messagebird`, etc.)
> - Any LinkedIn, Twitter/X, or social posting code (search for `linkedin`, `oauth`, scheduled-post patterns)
> - Password reset emails, notification emails, transactional emails — all paths
>
> For each path, note whether it currently writes a record and what fields it captures.
>
> ### Section 4 — User signup / agency creation flow
>
> The command centre needs growth metrics. Map:
> - How is a new agency created today? (self-serve signup route, admin-created, both?)
> - How is a new user within an agency created? Invitation flow?
> - What is captured at signup? (referrer, UTM params, source, anything?)
> - Is there an onboarding state machine or checklist?
> - What route handles `POST /api/auth/[...]/register` or equivalent?
>
> ### Section 5 — Existing superadmin role and access
>
> - Where is the `superadmin` role checked? List every guard / middleware / page check.
> - Is there an existing internal admin UI? If so, what does it cover?
> - How is the superadmin user(s) created — seed, manual SQL, env var?
> - Is there any audit trail of superadmin actions?
>
> ### Section 6 — Background jobs and scheduled work
>
> The command centre will need scheduled refreshes (metric rollups, automated post publishing).
> - Is there a job runner today? (Vercel Cron, BullMQ, Inngest, raw setInterval, none?)
> - List every scheduled job that exists, where it's defined, and what it does.
> - If nothing exists: what's the closest thing (manual cron entry in `vercel.json`, anything)?
>
> ### Section 7 — Stack confirmation
>
> Confirm by reading `package.json`, `next.config.*`, `prisma/schema.prisma`:
> - Next.js version and router (App Router vs Pages)
> - Prisma version
> - NextAuth version
> - UI library (shadcn? plain Tailwind? something else?)
> - Charting library if any (recharts? tremor? none?)
> - Any analytics SDKs already installed (PostHog, Plausible, Vercel Analytics, etc.)
> - Date/time library (date-fns, dayjs, luxon)
>
> ### Section 8 — Database size and shape (optional but useful)
>
> If you have a way to run a read-only query against the dev database, note approximate row counts for: `Agency`, `User`, `PropertyTransaction`, `MilestoneCompletion`, `CommunicationRecord`, `ChaseTask`, `FeedbackSubmission`. If you can't, skip this section — don't guess.
>
> ### Output format
>
> Write the report as `ADMIN_00_DISCOVERY_REPORT.md` in the repo root. Use the section headings above. Be concrete. Quote code. Cite file:line. If a section returns "nothing exists," say that clearly — that's a valid and important finding.
>
> Do not edit any files. Do not run migrations. Do not install packages. Read-only investigation.

---

## What happens next

Once you have the report:

1. Share it with me (paste contents into chat).
2. I'll revise `ADMIN_02_DATA_MODEL.md` and `ADMIN_03_METRICS_CATALOGUE.md` against the real schema.
3. Then CC implements doc 02 first (migrations + seed), then docs 01 → 06 in order.
