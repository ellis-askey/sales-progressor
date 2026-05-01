# ADMIN_04 — Outbound Log

**Audience:** Claude Code
**Status:** Draft
**Depends on:** ADMIN_02 (`OutboundMessage` schema)
**Implements:** the `/command/outbound` tab

---

## 1. What this is

A unified, searchable, filterable log of every outbound message the system has ever sent or drafted. Email chases, AI-generated drafts (sent or not), LinkedIn posts (when ADMIN_05 ships), password reset emails, anything that left the platform headed for a human.

This is the founder's "let me see what we actually said to the world" view. Two reasons it exists:

1. **Operational:** When a customer says "I never got an email," you need to find that message in seconds.
2. **Quality:** AI-generated content is going out at volume. You need to be able to spot a bad pattern before it scales.

---

## 2. Data foundation

All entries come from the `OutboundMessage` table defined in ADMIN_02 §4. No other source. If a message exists in the world but not in this table, the system has a bug — surface it as an error in ADMIN_06 §audit, don't paper over it.

The implementation work for this tab is mostly UI + query + indexing. The schema does the heavy lifting.

---

## 3. Page layout

Three regions, top to bottom:

### 3.1 Header bar (sticky)

Five summary numbers, each clickable to apply a filter:

- **Today** — total messages created today
- **Sent today** — messages with `sentAt::date = today`
- **AI today** — messages with `isAiGenerated = true` created today
- **Awaiting approval** — `requiresApproval = true AND approvedAt IS NULL AND status != 'cancelled'`
- **Failed (24h)** — `failedAt >= now() - 24h`

Plus the page-level SP/PM toggle (inherited from ADMIN_01 §5.2).

### 3.2 Filter bar

A row of filter controls. Selected filters reflected in URL.

| Filter | Type | Default |
|---|---|---|
| Channel | multi-select (email, sms, linkedin, twitter, in_app, other) | all |
| Status | multi-select (draft, scheduled, queued, sent, delivered, opened, clicked, bounced, failed, cancelled) | all |
| AI generated | tri-state (yes / no / either) | either |
| Date range | date picker, with presets (today, 7d, 30d, all time) | last 7d |
| Agency | multi-select | all |
| Recipient search | free text — matches `recipientName`, `recipientEmail`, `recipientHandle` | empty |
| Body search | free text — full-text search on `body` and `subject` | empty |

Body search is the expensive one. Implementation notes in §6.

### 3.3 Message list

Virtualised list, infinite scroll. Each row collapsed by default:

```
┌─────────────────────────────────────────────────────────────────┐
│ ✉  email · sent · 14:32  │  Acme Estates · 12 Acacia Avenue    │
│ To: David Mitchell <david@chambers.legal>                       │
│ Subject: Following up on mortgage offer                          │
│ ✦ AI · Claude Haiku 4.5 · ⌃ approved by you · 234 tokens       │
└─────────────────────────────────────────────────────────────────┘
```

Click a row → expands to show full body, full metadata (provider message ID, webhook history, AI prompt version), action buttons (resend, copy body, view related transaction).

Density: roughly 80px per collapsed row. Intentionally not a tight table — readability matters when scanning AI output.

---

## 4. Row badges

Each row carries a row of small badges that make scanning easier. Badge logic:

| Badge | Condition | Colour |
|---|---|---|
| ✉ | `channel = email` | neutral |
| 💬 | `channel = sms` | neutral |
| in | `channel = linkedin` | brand blue |
| 𝕏 | `channel = twitter` | neutral |
| ⌚ | `channel = in_app` | neutral |
| ✦ AI | `isAiGenerated = true` | purple |
| ⌃ approved | `requiresApproval = true AND approvedAt IS NOT NULL` | green |
| ⏳ pending | `requiresApproval = true AND approvedAt IS NULL` | amber |
| 📬 delivered | `status = delivered` | green |
| 👁 opened | `openedAt IS NOT NULL` | green |
| 🔗 clicked | `clickedAt IS NOT NULL` | bright green |
| ↩ bounced | `status = bounced` | red |
| ✗ failed | `status = failed` | red |
| ⏱ scheduled | `status = scheduled AND scheduledFor IS NOT NULL` | amber |

Badges combine. A delivered, opened, AI-generated email has four badges in a row.

---

## 5. Drill-down panel

Clicking a row expands inline. Top-down:

- **Full content** — body rendered according to `bodyFormat` (plain / markdown / html). HTML is sandboxed in an iframe with `sandbox="allow-same-origin"` only — no JS execution, no top-level navigation.
- **Recipient block** — name, email/handle, link to the contact record if `recipientEmail` matches a `Contact` row
- **Linked transaction** — if `transactionId` set, link to the transaction page
- **AI provenance** — model, prompt version, token counts, computed cost in £ and $
- **Lifecycle timeline** — vertical list of timestamps: created → scheduled → queued → sent → delivered → opened → clicked. Each populated event is filled in; missing events shown greyed.
- **Webhook history** — collapsible JSON view of `providerWebhookData` (read-only)
- **Actions** — "Copy body to clipboard," "Resend" (only enabled for failed/bounced), "View in provider dashboard" (link to SendGrid / LinkedIn that opens the right record)

---

## 6. Search & query performance

The body search is the hardest part of this tab. Three implementation options:

### Option A — Postgres `tsvector` full-text search

Add a generated column on `OutboundMessage`:

```prisma
// (Prisma doesn't natively support generated tsvector; use a raw SQL migration)
ALTER TABLE "OutboundMessage" ADD COLUMN "bodySearch" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, ''))) STORED;
CREATE INDEX outbound_body_search_idx ON "OutboundMessage" USING GIN ("bodySearch");
```

Query: `WHERE "bodySearch" @@ plainto_tsquery('english', $1)`.

Trade-offs: Built-in. No extra service. Adequate for tens of thousands of messages. Doesn't do fuzzy matching or typo tolerance, but for an internal tool that's fine.

### Option B — Supabase pg_trgm

If you want substring matching (e.g. partial email addresses): add the `pg_trgm` extension and a trigram index. Slower to build but supports `LIKE '%foo%'` efficiently.

### Option C — External search service

Algolia / Meilisearch / Typesense. Overkill for this. Don't.

**Default recommendation:** Option A for body/subject, plus B-style trigram index on `recipientEmail` and `recipientName` for partial matches.

---

## 7. Performance budget

This is the tab most likely to be slow. Targets:

- Initial page (today's view, no filters): under 500ms
- Filter change (any single filter): under 800ms
- Body search query: under 1.2s for any query against last 90 days
- Scroll to next page (50 more rows): under 300ms

Enforced by:
- Pagination uses keyset pagination on `(createdAt DESC, id)`, never offset
- Body search is hidden behind a debounced input (300ms) — no query fires until user pauses typing
- The compound index `(agencyId, createdAt)` covers the most common filter combinations
- Body content is NOT included in the list query — only fetched when a row is expanded

---

## 8. Privacy considerations

The Outbound Log displays content that may include PII from contacts who never directly consented to internal viewing.

For v1 (single user, founder only):
- All content is shown without redaction
- Every view of an expanded message body writes an `AdminAuditLog` entry: `action = "outbound_message.viewed"`, `targetId = message.id`
- No bulk export from the UI in v1 — copying individual messages only

If/when this page is ever opened to additional users, redaction and access controls become essential. Flag for ADMIN_06 §future-multi-user.

---

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Message has no `agencyId` (system-level email) | Group under "System" in agency filter; SP/PM toggle does not hide |
| Message body is > 100KB | Truncate display at 50KB with "Show full message" expander |
| Scheduled message in the past but not sent | Surface as anomaly in ADMIN_03 §3.5 — implies scheduler job failed |
| AI generated but not sent (draft only) | Always shows in log; status `draft`. Important — these are content the founder needs to review even if never sent |
| Message references deleted transaction | Show as "Transaction deleted" with original `transactionId` text |
| Webhook arrives for unknown `providerMessageId` | Logged as warning, not displayed; investigate via ADMIN_06 audit |

---

## 10. Out of scope for v1

These come later if needed:

- Bulk operations (delete, resend, export many)
- Saved filters / saved searches
- Email reply tracking (would require IMAP / inbound webhook)
- Sentiment scoring on AI output
- A/B test framework for AI prompt variants
- Multi-user access controls and redaction

The schema doesn't preclude any of them — they're UI work on top of the same `OutboundMessage` table.
