# Sales Progressor Chain System Inventory

**Audit Date:** 2026-05-19  
**Scope:** Complete chain feature implementation audit  
**Methodology:** Codebase analysis of data models, services, API routes, UI components, and workflows

---

## 1. DATA MODEL

### 1.1 PropertyChain Table

**File:** prisma/schema.prisma (lines 741–754)

| Field | Type | Constraints | Purpose |
|---|---|---|---|
| \id\ | String (cuid) | PRIMARY KEY | Unique chain identifier |
| \gencyId\ | String | FOREIGN KEY → Agency | Agency that owns this chain |
| \
ame\ | String? | NULLABLE | Optional chain name (for user reference) |
| \createdByUserId\ | String? | FOREIGN KEY → User (ChainCreatedBy) | User who initiated the chain creation |
| \status\ | ChainStatus enum | DEFAULT: ACTIVE | Chain status: ACTIVE, COMPLETED, ARCHIVED |
| \holdStatus\ | ChainHoldStatus enum? | NULLABLE | Optional: ON_HOLD or INCOMPLETE |
| \createdAt\ | DateTime | DEFAULT: now() | Timestamp of chain creation |
| \updatedAt\ | DateTime | AUTO | Last modification timestamp |

**Relationships:**
- ONE agency → MANY chains
- ONE user (creator) → MANY chains (via createdByUserId)
- ONE chain → MANY chain links (ChainLink.chain)

**Enums:**
- \ChainStatus\: ACTIVE, COMPLETED, ARCHIVED
- \ChainHoldStatus\: ON_HOLD, INCOMPLETE

### 1.2 ChainLink Table

**File:** prisma/schema.prisma (lines 756–806)

| Field | Type | Constraints | Purpose |
|---|---|---|---|
| \id\ | String (cuid) | PRIMARY KEY | Unique link identifier |
| \chainId\ | String | FOREIGN KEY → PropertyChain | Parent chain |
| \position\ | Int | UNIQUE(chainId, position) | 0-indexed position in chain (top=0) |
| \createdByUserId\ | String? | FOREIGN KEY → User (ChainLinkCreatedBy) | User who created this link (originator) |
| \	ransactionId\ | String? | UNIQUE; FOREIGN KEY → PropertyTransaction | Transaction this link is claimed by |
| \claimedByUserId\ | String? | FOREIGN KEY → User (ChainLinkClaimedBy) | User who claimed this link |
| \claimedAt\ | DateTime? | NULLABLE | Timestamp when link was claimed |
| \externalAddress\ | String? | NULLABLE | Legacy field (v1) — do not use in new code |
| \externalStatus\ | String? | NULLABLE | Legacy field (v1) — do not use in new code |
| **Stub Data (v2, unclaimed links)** | | | |
| \stubPropertyAddress\ | String? | NULLABLE | Property address while unclaimed |
| \stubAgencyName\ | String? | NULLABLE | Agency name (title-cased) |
| \stubAgentEmail\ | String? | NULLABLE; INDEX | Agent email for invite (lowercase, trimmed) |
| \stubAgentName\ | String? | NULLABLE | Agent contact name |
| \stubAgentPhone\ | String? | NULLABLE | Agent phone number |
| \stubNotes\ | String? | NULLABLE | Internal notes about this link |
| **Invite Tracking** | | | |
| \inviteStatus\ | InviteStatus enum | DEFAULT: NOT_SENT | NOT_SENT, SENT, BOUNCED, CLAIMED, DECLINED |
| \inviteToken\ | String? | UNIQUE | 64-char hex token for claim page |
| \inviteSentAt\ | DateTime? | NULLABLE | When first invite was sent |
| \inviteBouncedAt\ | DateTime? | NULLABLE | When email bounced (set by webhook) |
| \inviteDeclinedAt\ | DateTime? | NULLABLE | When invite was explicitly declined |
| \inviteResendCount\ | Int | DEFAULT: 0 | Count of invite resends |
| \lastInviteSentByUserId\ | String? | FOREIGN KEY → User | User who sent most recent invite |
| **Deferred (v1.1)** | | | |
| \withdrawalStatus\ | ChainWithdrawalStatus enum? | NULLABLE | WITHDRAWN, REMARKETING, WAITING (not yet wired) |
| \withdrawalRespondedAt\ | DateTime? | NULLABLE | Timestamp when agent responded to withdrawal |
| \createdAt\ | DateTime | DEFAULT: now() | Timestamp of link creation |
| \updatedAt\ | DateTime | AUTO | Last modification timestamp |

**Unique Constraints:**
- \(chainId, position)\ — ensures positions don't duplicate within a chain
- \inviteToken\ — tokens are globally unique

**Indexes:**
- \	ransactionId\ — for lookup by transaction
- \claimedByUserId\ — for finding user's claimed links
- \stubAgentEmail\ — for finding links by stub email (used in bounce webhook)

**Enums:**
- \InviteStatus\: NOT_SENT, SENT, BOUNCED, CLAIMED, DECLINED
- \ChainWithdrawalStatus\: WITHDRAWN, REMARKETING, WAITING


### 1.3 PropertyTransaction Chain Fields

**File:** prisma/schema.prisma (lines 206–208)

The PropertyTransaction table has two chain-related fields:

| Field | Type | Constraints | Purpose |
|---|---|---|---|
| \chainLinkId\ | String? | UNIQUE; FOREIGN KEY → ChainLink | Canonical chain link for this transaction |
| (relation) \chainLinks\ | ChainLink[] | FOREIGN KEY (inverse) | Historical view of all links |

---

## 2. SERVICES AND ACTIONS

### 2.1 Chain Services

**File:** \lib/services/chains.ts\ (414 lines)

#### v2 Functions (Current Implementation)

| Function | Signature | Behavior | Status |
|---|---|---|---|
| \getChainV2\ | \(chainId: string) → Promise<ChainV2 ∣ null>\ | Fetch chain with v2 schema | ✅ Working |
| \getChainForTransactionV2\ | \(transactionId: string) → Promise<ChainV2 ∣ null>\ | Fetch chain via canonical chainLinkId | ✅ Working |
| \createChainV2\ | \(input: CreateChainInput) → Promise<ChainV2>\ | Create chain with originating transaction; optionally add stubs | ✅ Working |
| \ddChainLink\ | \(input: AddLinkInput) → Promise<ChainV2>\ | Add stub link above or below; shifts positions | ✅ Working |
| \updateChainLinkStub\ | \(linkId, data) → Promise<ChainLink>\ | Edit unclaimed stub (address, agency, email, notes) | ✅ Working |
| \emoveChainLink\ | \(linkId, chainId) → Promise<void>\ | Delete link and repack positions | ✅ Working |

### 2.2 Chain Invite Service

**File:** \lib/chain/invite.ts\ (251 lines)

| Function | Behavior | Status |
|---|---|---|
| \sendChainInvite\ | Generate token, update link, send HTML+text email | ✅ Working |
| \handleBouncedInvite\ | Called by SendGrid webhook; mark BOUNCED, notify originator | ✅ Working |

**Email:**
- Built inline (not SendGrid template ID)
- Subject: \{originatorAgency} has added you to a live chain — {propertyAddress}\
- Includes chain position, progress, two action URLs (claim/decline)

---

## 3. UI SURFACES

### 3.1 ChainDrawer Component

**File:** \components/chain/ChainDrawer.tsx\

**Purpose:** Modal drawer showing chain state with action buttons.

**Renders:**
- Header: "Chain progress" title + close button
- Empty state if no chain
- For existing chain: LinkCard stack with ChainConnector visuals
- Add Above / Add Below buttons (permission-gated)
- Resend invite, Delete, Bulk invite buttons

### 3.2 ChainSection Component (Form Integration)

**File:** \components/chain/ChainSection.tsx\

**Purpose:** In-form chain builder for new-sale flow.

**Renders:**
- Expandable section with originator card + stub cards
- Add above/below buttons
- Position selector (top/middle/bottom)

### 3.3 AddNodeDrawer Component

**File:** \components/chain/AddNodeDrawer.tsx\

**Purpose:** Drawer for adding link above/below in existing chain.

**Modes:**
1. **API mode** (if chainId): POST to \/api/chains/{chainId}/links\
2. **Memory mode** (if onSaveToMemory): Capture in parent state

### 3.4 Claim Pages (Invite Landing)

**Files:**
- \pp/claim/page.tsx\ — Public landing with chain teaser, benefits, claim button
- \pp/claim/confirm/page.tsx\ — Confirm with duplicate detection
- \pp/claim/signup/page.tsx\ — New account signup
- \pp/claim/login/page.tsx\ — Existing account login

---

## 4. WORKFLOWS — END-TO-END

### 4.1 Workflow A: Create Chain from Scratch on New Transaction

**Status:** ✅ **COMPLETE AND WORKING**

Steps:
1. Agent expands "Add to chain" section in new-sale form
2. Selects position (top/middle/bottom)
3. Clicks "Add above" or "Add below" → AddNodeDrawer (memory mode)
4. Fills stub details (address, agency, email, phone, notes)
5. Completes rest of form
6. Submits → \createTransactionAction()\ with chain stubs
7. Transaction created; milestones initialized
8. \createChainV2()\ called with transactionId + stubs (atomic transaction)
9. Origin transaction set as claimed link at calculated position
10. Above/below stubs created at correct positions
11. If \sendInvites\ flag: loop through links with emails, call \sendChainInvite()\
12. Emails sent with claim tokens
13. User redirected to transaction detail

---

### 4.2 Workflow B: Add Sale Above/Below Existing Chain

**Status:** ✅ **COMPLETE AND WORKING**

Steps:
1. Agent opens ChainDrawer on transaction with chainLinkId
2. Fetches chain via \GET /api/chains?transactionId=...\
3. Clicks "Add above" or "Add below" (permission-gated)
4. AddNodeDrawer opens in API mode
5. Fills form → POST \/api/chains/{chainId}/links\
6. Server validates participant status + permissions
7. \ddChainLink()\ called; shifts positions if needed
8. Returns updated chain
9. ChainDrawer refetches and displays new link

---

### 4.3 Workflow C: Invite Another Agent

**Status:** ✅ **COMPLETE AND WORKING**

Steps:
1. Agent sees unclaimed stub with email in ChainDrawer
2. Clicks "Send invite"
3. POST \/api/chains/{chainId}/links/{linkId}/invite\
4. Token generated (64-char hex), link updated (status=SENT, inviteSentAt, resendCount++)
5. Email sent with claim URL + chain context
6. Invited agent receives email

---

### 4.4 Workflow D: Invited Agent Landing → Claim

**Status:** ✅ **COMPLETE AND WORKING**

Steps:
1. Agent clicks claim URL: \/claim?token=...\
2. \pp/claim/page.tsx\ loads (no auth required)
3. Validates token; checks claim status (not already claimed/declined)
4. Renders chain teaser card + benefits + claim button
5. Routes based on auth state:
   - If logged in + email matches: \/claim/confirm?token=...\
   - If logged in + email mismatch: error state
   - If not logged in + email exists: \/claim/login?token=...\
   - If not logged in + email new: \/claim/signup?token=...\
6. Agent signs up or logs in
7. Redirects to \/claim/confirm\
8. Duplicate detection runs
9. Form to claim: "Create new" or "Link to existing"
10. POST \/api/claim\ with action + optional transactionId
11. Atomic transaction:
    - If create: new PropertyTransaction created with stub address
    - Update ChainLink: transactionId, claimedByUserId, claimedAt, status=CLAIMED
    - Update PropertyTransaction: chainLinkId → link.id
12. Redirect to transaction detail
13. Audit log entry created

---

### 4.5 Workflow E: Agent Updates Progress; Others See

**Status:** ⚠️ **PARTIAL** (updates stored, no broadcast)

Steps:
1. Agent completes milestones on their claimed transaction
2. Updates trigger \completeMilestone()\, \changeStatusAction()\, etc.
3. \propertyTransaction.lastActivityAt\ updated
4. Other agents in chain can:
   - Manually re-open ChainDrawer (click again)
   - See updated milestone counts on LinkCard
5. **NO REAL-TIME NOTIFICATION** to other agents
6. **NO EMAIL** when chain-mate completes milestone
7. **NO POLLING** in ChainDrawer

---

### 4.6 Workflow F: Withdrawal Cascade

**Status:** ❌ **NOT IMPLEMENTED**

What happens now:
1. Agent marks transaction \status = "withdrawn"\
2. Internal note created: "Agent X changed status from Active to Withdrawn"
3. \allThroughReason\ field set if provided
4. **NOTHING ELSE HAPPENS**

What should happen (designed but not coded):
- Query all links in same chain
- Send email to each claimed agent: "Your chain mate has withdrawn"
- Set \ChainLink.withdrawalStatus = WITHDRAWN\ 
- Show UI options: "Remarket" or "Mark my file as withdrawn"
- Send confirmation email to originator: "3 chain mates notified"

**Fields defined but never used:**
- \ChainLink.withdrawalStatus\ (enum: WITHDRAWN, REMARKETING, WAITING)
- \ChainLink.withdrawalRespondedAt\ (DateTime)

---

### 4.7 Workflow G: Remove Link from Chain

**Status:** ✅ **COMPLETE AND WORKING**

Steps:
1. Agent sees unclaimed stub in ChainDrawer
2. Clicks "Remove"
3. DELETE \/api/chains/{chainId}/links/{linkId}\
4. Permission check: canDeleteLink (originator only, unclaimed only)
5. \emoveChainLink()\ deletes link
6. \epackPositions()\ maintains contiguity
7. ChainDrawer refetches

---

### 4.8 Workflow H: Delete Entire Chain

**Status:** ⚠️ **MOSTLY COMPLETE, BUT ORPHANS REMAIN**

Steps:
1. No UI button found for delete in ChainDrawer
2. Assumed to call DELETE \/api/chains/{chainId}\
3. Permission check: creator OR admin
4. \deleteChain()\ called
5. Prisma cascade: all ChainLink rows deleted (onDelete: Cascade)
6. **BUT:** PropertyTransaction rows still have \chainLinkId\ pointing to deleted links
   - Foreign key is NULLABLE, so constraint allows orphaned references
   - No cleanup code to null out propertyTransaction.chainLinkId

**Missing fix:**
\\\	ypescript
await propertyTransaction.updateMany({
  where: { chainLinkId: { in: deletedLinkIds } },
  data: { chainLinkId: null }
});
\\\

---

## 5. WITHDRAWAL CASCADE — CURRENT STATE DETAIL

### 5.1 Schema Fields

**File:** \prisma/schema.prisma\ lines 789–790

\\\prisma
withdrawalStatus      ChainWithdrawalStatus?
withdrawalRespondedAt DateTime?
\\\

**Enum:** \ChainWithdrawalStatus\ = WITHDRAWN | REMARKETING | WAITING

### 5.2 What's Missing

| Component | Expected | Actual |
|---|---|---|
| Query linked chain on withdrawal | Find all chainLinks in same chain | ❌ Never happens |
| Update withdrawal status | Set \ChainLink.withdrawalStatus\ for each | ❌ Never happens |
| Email to linked agents | Send withdrawal notification | ❌ Never happens |
| In-app notification | Create in-app alert | ❌ Never happens |
| UI response options | "Remarket" / "Mark withdrawn" buttons | ❌ Never rendered |
| Cascade confirmation | Toast: "3 chain mates notified" | ❌ Never shown |

---

## 6. KNOWN GAPS AND HALF-BUILT FEATURES

### 6.1 Explicit Markers

**TODO/FIXME/HACK comments:** ❌ **None found in chain code**

All chain code is clean of explicit markers.

### 6.2 Stub Fields for Future Use

**Lines 789–790:** \withdrawalStatus\ and \withdrawalRespondedAt\

**Status:** ⚠️ Defined but never written; no UI; design pending

### 6.3 Missing UI Elements

| Feature | Found | Status |
|---|---|---|
| Delete chain button | ❌ Not in ChainDrawer | Missing UI |
| Edit stub after sending invite | ❌ Not found | Missing feature |
| Bulk resend invites | ✅ Found (line 110–129) | Working |
| Decline invite flow | ⚠️ Route exists, implementation unknown | Partial |
| Withdrawal cascade notification | ❌ Not found | Missing |
| Remarket option post-withdrawal | ❌ Not found | Missing |

### 6.4 Error Handling Issues

**Chain creation failure** (\	ransactions.ts\ line 224–227):
\\\	ypescript
} catch (err) {
  console.error("Chain creation failed:", err);
  chainFailed = true;
}
\\\

- Transaction succeeds even if chain fails (non-fatal)
- User sees **no error message or warning**
- Flag returned but UI doesn't act on it

**Status:** ⚠️ Silently fails; user not notified

### 6.5 Token Expiry

**File:** \lib/chain/invite.ts\ line 38

\\\	ypescript
const token = crypto.randomBytes(32).toString("hex");
\\\

- Token generated with strong entropy (256 bits)
- **No TTL logic** — token lives indefinitely
- Can be claimed any time after generation
- If token leaked, it can be used years later

**Risk:** ⚠️ Tokens never expire

### 6.6 Bounce Handling

**File:** \lib/chain/invite.ts\ lines 204–250

**Implemented:**
- Webhook handler detects bounce
- \inviteBouncedAt\ timestamp set; status = BOUNCED
- Email sent to originator

**Missing:**
- No automatic retry with corrected email
- No admin dashboard showing bounced invites
- No metrics on bounce rate

**Status:** ⚠️ Basic handling; no recovery flow

---

## 7. POLISH PASS CROSS-REFERENCE

**File:** \docs/polish-pass/PAGE_LIST.md\

### 7.1 Chain Pages in Main Polish Queue

| Page | Route | Priority | Polish Status | Relevance |
|---|---|---|---|---|
| New sale (new-v2) | \/agent/transactions/new-v2\ | 1 | Deferred Stage 4 | **PRIMARY** — ChainSection core UI |
| Transaction detail | \/agent/transactions/[id]\ | 2 | Stage 4 complete | **HIGH** — ChainDrawer integration |
| Hub | \/agent/hub\ | 3 | Not started | **MEDIUM** — May show chain stats |
| Work queue | \/agent/work-queue\ | 4 | Not started | **LOW** — Unlikely chain context |
| Transaction list | \/agent/transactions\ | 5 | Not started | **MEDIUM** — May show chain badges |
| Analytics | \/agent/analytics\ | 10 | Not started | **LOW** — May show chain completion rates |

### 7.2 Deferred (Separate Chain Sweep)

**Lines 287–296 of PAGE_LIST.md:**

| Route | File | Status |
|---|---|---|
| \/claim\ | \pp/claim/page.tsx\ | Deferred |
| \/claim/signup\ | \pp/claim/signup/page.tsx\ | Deferred |
| \/claim/login\ | \pp/claim/login/page.tsx\ | Deferred |
| \/claim/confirm\ | \pp/claim/confirm/page.tsx\ | Deferred |

**Note:** Chain pages will be redesigned in separate "chain feature sweep" after main agent pass.

---

## 8. EXTERNAL DEPENDENCIES

### 8.1 Email Sending

**Provider:** SendGrid (via \lib/email\)

**Template type:** ❌ **Inline HTML** (not SendGrid template ID)

**Built in-memory:**
- \uildInviteHtml()\ — 23 lines of hardcoded HTML
- \uildInviteText()\ — 16 lines of plain text

**Tracking:**
- Open tracking: ❌ Not implemented
- Click tracking: ❌ Not implemented
- Bounce tracking: ✅ Implemented via webhook

### 8.2 Token Generation

**File:** \lib/chain/invite.ts\ line 38

\\\	ypescript
const token = crypto.randomBytes(32).toString("hex");
\\\

- Entropy: 32 bytes = 256 bits
- Format: 64 hex characters
- Storage: \ChainLink.inviteToken\ (unique constraint)
- **Expiry:** ❌ No TTL logic

### 8.3 Authentication

**Provider:** NextAuth.js

**Session context:** Every API route checks \getServerSession(authOptions)\

**User fields:** \id\, \gencyId\, \ole\, \email\

**Chain-specific gates:**
- \canViewChain\ — user is creator or claimer
- \canAddAbove / canAddBelow\ — originator or claimer
- \canEditLink / canDeleteLink\ — originator while unclaimed
- \canSendInvite\ — originator, unclaimed, email present

### 8.4 Database Transactions

**Atomic operations:**
- \createChainV2()\ — wrapped in \prisma.\()\
- \ddChainLink()\ — wrapped in \prisma.\()\
- \/api/claim\ (both actions) — wrapped
- \confirmSaleDetailsAction()\ — wrapped

**Status:** ✅ Consistent use of transactions

### 8.5 Third-Party Integrations

| Service | Used For | Status |
|---|---|---|
| SendGrid | Email (invites, bounces, notifications) | ✅ Integrated |
| NextAuth.js | Authentication + sessions | ✅ Integrated |
| Prisma ORM | Database queries + transactions | ✅ Integrated |
| Vercel | Hosting, serverless functions | ✅ Assumed |

---

## Summary: Feature Completeness Matrix

| Workflow / Feature | Status | Notes |
|---|---|---|
| Create chain from scratch | ✅ Complete | End-to-end in new-sale form |
| Add link above/below | ✅ Complete | Implemented for existing chains |
| Send chain invite | ✅ Complete | Email delivery + bounce handling |
| Invited agent landing page | ✅ Complete | Teaser, benefits, account routing |
| Claim link (create) | ✅ Complete | Atomic; duplicate detection |
| Claim link (link existing) | ✅ Complete | Atomic; validation present |
| View chain in drawer | ✅ Complete | Fetch + permission checks |
| Edit unclaimed stub | ✅ Complete | PATCH endpoint + UI |
| Delete unclaimed stub | ✅ Complete | DELETE endpoint + confirmation |
| Resend invite | ✅ Complete | Single + bulk buttons |
| View real-time progress | ⚠️ Partial | No polling/websocket; manual refresh |
| Notification to chain-mates | ❌ Missing | No email or in-app alert |
| **Withdrawal cascade** | ❌ Missing | Fields exist; behavior absent; no emails or UI |
| Decline invite | ⚠️ Unknown | Route expected; implementation not read |
| Respond to withdrawal | ❌ Missing | UI and handlers not found |
| Delete entire chain | ⚠️ Incomplete | Orphans transaction references |
| Token expiry | ❌ Missing | Tokens live indefinitely |
| Metrics / reporting | ❌ Missing | No completion rates or invite stats |

---

**End of Audit**

Report prepared for Stage 2 design. All gaps are facts based on codebase analysis; no recommendations included.

