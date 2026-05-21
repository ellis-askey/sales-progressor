# Portal: Document Sharing — Feature Spec

**Status:** Planned — awaiting implementation  
**Date:** 2026-05-20  
**Author:** Ellis Askey

---

## What this is

A Documents tab on the buyer/seller portal that lets any contact upload, categorise, and control who sees their documents. The agent gets a matching read-only view. Email notifications fire when a document is shared.

---

## Problem it solves

Today, buyers and sellers have one narrow upload point (searches receipt, PM10). Everything else gets emailed around ad hoc — parties lose track of what's been shared, and the agent has no visibility. This gives everyone a single place to organise and share documents, with the agent looped in automatically when appropriate.

---

## Who uses it

| Party | Can do |
|---|---|
| Portal contact (vendor/buyer) | Upload, categorise, control sharing, download their own and shared docs |
| Agent (director/negotiator) | Read-only view of docs shared with them; download |
| Portal contact (other side) | See and download docs explicitly shared with everyone |

---

## Visibility levels

Three levels. **Can only increase — never go back** (once shared, cannot be un-shared):

| Level | Label in UI | Who can see it |
|---|---|---|
| `PRIVATE` | "Just me" | Uploader only |
| `AGENT` | "Share with agent" | Uploader + agent team |
| `ALL` | "Share with everyone" | Uploader + agent + all portal contacts on the transaction |

---

## Document categories

Preset list — contact picks one when uploading. One category per document.

- Survey
- Mortgage & Finance
- Searches
- Property Information
- Identification
- Completion & Legal
- Other

---

## User journeys

### Contact uploads a document

1. Opens **Documents** tab on their portal
2. Taps upload → picks a file (PDF, JPG, PNG, Word, Excel — max 10 MB)
3. Selects a category from the preset list
4. Visibility defaults to **"Just me"** (PRIVATE)
5. File appears in their Documents list immediately

### Contact shares a document with the agent

1. Finds the document in their list
2. Taps **Share** → sees three options (Just me / Share with agent / Share with everyone)
3. Selects "Share with agent"
4. Document marked as AGENT — agent can now see and download it
5. Agent receives an email: _"[Contact name] shared a document with you on [property address]."_

### Contact shares with everyone

1. Same flow as above but selects "Share with everyone"
2. All other portal contacts on the transaction can now see and download it
3. Each other contact receives an email: _"[Contact name] shared [filename] with you."_

### Agent views documents

1. Opens the **Documents** tab on the transaction page (agent app)
2. Sees all documents with visibility AGENT or ALL — grouped by category
3. Sees uploader name, role (vendor / buyer), date, file size
4. Can download any visible document

---

## What the UI looks like

### Portal Documents page

```
┌─────────────────────────────────────────┐
│  Documents                              │
│  Upload files and share with your team  │
├─────────────────────────────────────────┤
│  [+ Upload document]                    │
├─────────────────────────────────────────┤
│  SURVEY                                 │
│  ┌──────────────────────────────────┐   │
│  │  survey-report.pdf               │   │
│  │  2.4 MB · 18 May 2026           │   │
│  │  🔒 Just me         [Share ▾]   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  MORTGAGE & FINANCE                     │
│  ┌──────────────────────────────────┐   │
│  │  mortgage-offer.pdf              │   │
│  │  1.1 MB · 19 May 2026           │   │
│  │  👤 Shared with agent  [Share ▾]│   │
│  └──────────────────────────────────┘   │
│                                         │
│  SHARED WITH YOU                        │
│  ┌──────────────────────────────────┐   │
│  │  id-proof.jpg                    │   │
│  │  Shared by: John Smith (vendor)  │   │
│  │  Identification · 17 May 2026    │   │
│  │                     [Download]   │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Agent Documents tab (transaction page)

```
┌─────────────────────────────────────────┐
│  Documents                              │
│  Docs shared with you by buyers/sellers │
├─────────────────────────────────────────┤
│  SURVEY                                 │
│  survey-report.pdf                      │
│  Jane Brown (buyer) · 18 May · 2.4 MB  │
│                              [Download] │
├─────────────────────────────────────────┤
│  MORTGAGE & FINANCE                     │
│  mortgage-offer.pdf                     │
│  Jane Brown (buyer) · 19 May · 1.1 MB  │
│                              [Download] │
└─────────────────────────────────────────┘
```

---

## Technical changes

### 1. Database schema — `prisma/schema.prisma`

Add `DocumentVisibility` enum and three new fields to `TransactionDocument`:

```prisma
enum DocumentVisibility {
  PRIVATE
  AGENT
  ALL
}
```

New fields on `TransactionDocument`:
- `visibility DocumentVisibility @default(PRIVATE)`
- `category String @default("Other")`
- `uploadedById String?` — null for portal contacts, agent's user ID for agent uploads
- New index: `@@index([transactionId, visibility])`

Migration applies to **staging first**, then production.

### 2. API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/portal/documents?token=` | GET | List docs visible to this contact |
| `/api/portal/documents` | POST | Upload a doc (extend existing — add visibility + category) |
| `/api/portal/documents/[id]` | PATCH | Change visibility (own docs only, upward only) |
| `/api/portal/documents/[id]` | DELETE | Delete own doc (PRIVATE only — once shared, no delete) |
| `/api/portal/documents/[id]/download` | GET | Return a Supabase signed URL (60s TTL) |

### 3. New portal page

`app/portal/[token]/documents/page.tsx` — server component rendering the Documents tab.

### 4. Portal nav update — `components/portal/PortalShell.tsx`

Change bottom nav from 3 tabs (`grid-cols-3`) to 4 tabs (`grid-cols-4`). Add Documents tab with an icon.

### 5. Agent Documents tab

New component `components/transaction/DocumentsSection.tsx`. Added to the transaction page tab list in `app/agent/transactions/[id]/page.tsx`.

### 6. Email notifications

Via SendGrid (`lib/email.ts`) — same path as existing portal emails:
- Visibility → AGENT: email all agents on the transaction
- Visibility → ALL: email all other portal contacts on the transaction

---

## Edge cases / decisions

| Scenario | Decision |
|---|---|
| Contact tries to set visibility back to PRIVATE | Blocked in UI and API (400 Bad Request) |
| Contact deletes a doc shared with agent | Not allowed once shared — delete only works on PRIVATE |
| Agent tries to see a PRIVATE doc | Not returned by the query |
| Other portal contact tries to see an AGENT doc | Not returned |
| File too large (>10 MB) | Rejected at upload with clear error message |
| Unsupported file type | Rejected at upload |
| Two contacts share a doc at the exact same time | No conflict — independent rows in DB |
| Existing SearchesUpload at PM10 | No change — POST without new fields gets PRIVATE + "Searches" defaults |

---

## Files to change / create

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add enum + 3 fields to TransactionDocument |
| Migration SQL | Staging first, then production |
| `app/api/portal/documents/route.ts` | Extend POST; add GET |
| `app/api/portal/documents/[id]/route.ts` | New: PATCH + DELETE |
| `app/api/portal/documents/[id]/download/route.ts` | New: signed URL |
| `lib/services/documents.ts` | New: `getTransactionDocuments` for agent view |
| `app/portal/[token]/documents/page.tsx` | New portal page |
| `components/portal/PortalShell.tsx` | 4th tab, grid-cols-4 |
| `components/transaction/DocumentsSection.tsx` | New agent view component |
| `app/agent/transactions/[id]/page.tsx` | Add Documents tab |

---

## Verification checklist

- [ ] Contact uploads → visible to them as PRIVATE
- [ ] Contact shares with agent → agent sees it; agent receives email
- [ ] Contact shares with everyone → other contact sees it; they receive email
- [ ] Backwards sharing rejected in UI and at API level (400)
- [ ] Delete works for PRIVATE; blocked for AGENT/ALL
- [ ] Download returns a working signed URL; URL expires
- [ ] Agent never sees PRIVATE docs
- [ ] Existing `SearchesUpload.tsx` continues to work unchanged
- [ ] `tsc --noEmit` passes
