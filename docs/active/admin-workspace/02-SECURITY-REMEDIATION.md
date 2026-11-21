# TSP Admin — security remediation proposal

**Status:** proposal only. No code changed. Several items below **must not be implemented without your explicit approval** (flagged ⛔). This doc explains the intended design, the actual risk, the affected code, the consequences, and a safe sequence — so you can approve each piece deliberately.

**Scope:** the four findings from the audit — (1) hybrid-superadmin bypassing 2FA/step-up, (2) `commandDb` full database access, (3) `ADMIN_IP_ALLOWLIST`, (4) incomplete admin audit logging — plus the one new requirement: **server-side step-up for sensitive financial/destructive operations, including the founder's account** (decision 5).

**Guiding constraint (your instruction):** do **not** automatically enforce IP restrictions, change database access, or alter authentication without explaining the consequences and obtaining approval. Accordingly, this proposal separates **"safe to build now"** from **⛔ "needs your sign-off because it changes who can do what."**

---

## 0. Summary & recommendation

| # | Finding | Actual risk today | Proposed action | Approval |
|---|---|---|---|---|
| 1 | Hybrid-superadmin (you) skips 2FA/step-up entirely | Medium → **High once financial writes exist** | Add a **server-side `requireStepUp()`** on sensitive actions that applies to **everyone, including hybrid** (new, additive). Do **not** change the general Command-Centre browsing bypass. | ⛔ changes your own flow — approve |
| 1b | Hybrid detection is defined two different ways (role vs email) | Low today, fragile | Unify on a single `isHybridSuperadmin(session)` helper | Safe (no behaviour change) |
| 2 | `commandDb` is a full-access client, no DB-level isolation | Medium (mitigated by app-layer guard) | **Document** the true model (fix CLAUDE.md), add a lint/convention guard. **Do not** change DB access / RLS now. | Safe to document; ⛔ any RLS change |
| 3 | `ADMIN_IP_ALLOWLIST` enforced but exact-match (CIDR silently fails); dead parse in `config.ts` | Low (off by default) | **Document** the limitation; remove the dead parse. **Do not** enable or change IP enforcement. | Safe to document; ⛔ any enforcement change |
| 4 | ~half of admin mutations don't write `AdminAuditLog` | Medium → **blocks financial actions** | **Close the coverage gap** on existing mutations (additive logging) | Safe — recommended first |

**Recommendation:** do **4** (audit coverage) and **1b** (unify hybrid detection) and the *documentation* parts of **2** and **3** first — all additive/safe. Then do **1** (`requireStepUp()`) as the gate that makes financial actions possible. Hold the enforcement changes in 2 and 3 for a separate, explicitly-approved decision.

---

## 1. Hybrid-superadmin bypasses 2FA/step-up

### Intended design
Real superadmins authenticate with TOTP and hold a short-lived step-up cookie; the founder (hybrid, `role = sales_progressor` + allowlisted email) keeps the normal progressor UX and was deliberately exempted from the 2FA/step-up friction for day-to-day Command-Centre browsing.

### Actual behaviour (verified)
- `app/command/(protected)/layout.tsx:38`: `const isHybridSuperadmin = session.user.role !== "superadmin";` — and the entire TOTP + step-up block (`:47-59`) runs **only when `!isHybridSuperadmin`**. So you reach every `/command` page with just a NextAuth session.
- The only mutations that require step-up are **four route handlers** — `offboard` + the three `/api/gdpr/*` — and each *also* hard-requires `role === "superadmin"`, so **you (hybrid) currently cannot invoke them at all**; they're superadmin-only.
- **Every other mutation** (automation flags, fee tier, mark-free, content, uploads, publishing, demo reset, provider/quote actions, etc.) checks superadmin-or-hybrid via inline `hasSuperAdminPowers` and performs **no step-up check**.

### Actual risk
Today: medium — the Command Centre is still gated by a strong superadmin/allowlist check, and the genuinely destructive routes are superadmin-only. **But the moment refunds/credits/subscription-writes land, "no step-up for the founder" means a stolen/attached founder session could move money with zero second factor.** Decision 5 closes exactly this.

### Proposed design — a server-side `requireStepUp()` (additive)
A new shared guard, co-located with the existing verifier:

```
lib/command/session.ts
  requireStepUp(): asserts a fresh command_session cookie
    1. read cookie: cookies().get(COOKIE_NAME)?.value       // already works in server actions (4 routes do it)
    2. payload = verifySession(cookie)                        // existing HMAC + timingSafeEqual
    3. if !payload || now - payload.stepUpAt > STEP_UP_MAX_AGE_MS  → throw StepUpRequired
```

This **reuses** `verifySession` (`session.ts:45`), `COOKIE_NAME` (`:16`), and `STEP_UP_MAX_AGE_MS` (`config.ts:27`). It replaces the four duplicated local `stepUpValid()` copies (offboard + 3 GDPR) with one exported function.

**Critically, `requireStepUp()` applies to everyone — including hybrid.** To make that usable for you, hybrids must be able to *obtain* a step-up:
- **Prerequisite:** the founder enrols TOTP too. `setup-2fa` is currently gated `role === "superadmin"` and would need to accept the allowlisted hybrid. This is the one real behaviour change to your flow: you'd set up an authenticator once, then re-enter a 6-digit code before a sensitive action (not for browsing).
- Sensitive actions call `requireStepUp()` **in addition to** the existing `hasSuperAdminPowers` check. Non-sensitive browsing/reporting is untouched — you keep frictionless access to everything read-only.

**Which actions get `requireStepUp()`** (the "sensitive" set): all financial writes (refunds, credits, invoice issue/void, subscription changes), all destructive/irreversible account actions (offboard close/purge, GDPR erase), and view-as (impersonation). Automation-flag/fee-tier/content edits stay step-up-free unless you want them included.

### Consequences
- **You** will, once per 30-minute window, re-enter a TOTP code before a money-moving or destructive action. Browsing, reports, and routine toggles are unaffected.
- The four existing superadmin-only destructive routes can optionally be opened to hybrid-with-step-up (your call), or left superadmin-only.
- No change to how non-sensitive pages or the general bypass work.

⛔ **Approve before building:** this changes *your* authentication flow for sensitive actions (TOTP enrolment + step-up prompts). Nothing is built until you say go.

---

## 1b. Hybrid detection defined two ways (fragile)

- `hasSuperAdminPowers` (`lib/agent-session.ts:78`) and `middleware.ts:38` key "hybrid" on **email allowlist** (`HYBRID_SUPERADMIN_EMAILS`).
- The protected layout (`:38`) keys it on **`role !== "superadmin"`**.
These converge only because the outer gate already guaranteed superadmin-or-allowlisted. It's correct today but brittle (noted independently in `docs/compliance/dpia/final-audit/REMEDIATION-VERIFICATION.md:85`).

**Proposed:** one exported `isHybridSuperadmin(session)` helper (email-based, matching `hasSuperAdminPowers`), used by layout, middleware and the new guard. **No behaviour change** — pure de-duplication. Safe to do alongside Phase 0.

---

## 2. `commandDb` has no DB-level isolation

### Finding
`lib/command/prisma.ts` exports `commandDb` as a second plain `PrismaClient` with **full database access** — no RLS, no superadmin DB context. The `rls-test` route confirms RLS is in bypass. Isolation is entirely the app-layer superadmin guard. **CLAUDE.md is wrong** — it describes `commandDb` as carrying "explicit superadmin context."

### Actual risk
Medium. The app-layer guard is real and consistently applied, so there's no *current* exposure — but the mental model is wrong, which is dangerous when new "operate" actions are added: a developer trusting the CLAUDE.md wording might assume DB-level protection that doesn't exist.

### Proposed action
- **Safe now:** fix CLAUDE.md and PRODUCT_TRUTH to state the true model ("full-access client; isolation is the app-layer superadmin guard; every `commandDb` caller must be superadmin-gated"). Add a short convention note + optionally a lint check that `commandDb` is only imported under `lib/command/**` / `app/command/**` / `app/api/command/**`.
- ⛔ **Do NOT** introduce RLS / a scoped DB role now. That is a significant change with migration + connection implications and must be its own approved piece. Documented here as a *future option*, not a proposal to action.

### Consequences
Documentation + lint: none to runtime. RLS (if ever): connection/pooling changes, migration, staging-first, risk of breaking every command read — explicitly out of scope until separately approved.

---

## 3. `ADMIN_IP_ALLOWLIST`

### Finding (corrected from the first audit)
It **is enforced** — `middleware.ts:50-60` returns 403 when the client IP (from `x-forwarded-for[0]`/`x-real-ip`) isn't in the list. But:
- The `lib/command/config.ts:19-25` parse (`IP_ALLOWLIST`) is imported **nowhere** — dead duplicate.
- Matching is exact-string (`allowed.includes(ip)`), so **CIDR ranges silently never match**, despite docs (`docs/admin/ADMIN_06…`) describing CIDR and a 404 (the code returns 403).
- Default is empty → **off**. So there's no current restriction in production unless you've set the env var.

### Actual risk
Low — it's off by default and, when on, fails safe (403). The real risk is *false confidence*: someone sets a CIDR range expecting coverage and gets silent non-matching.

### Proposed action
- **Safe now:** remove the dead `config.ts` parse; fix the docs (403 not 404; exact-match not CIDR).
- ⛔ **Do NOT** enable IP enforcement or change the matcher without approval. If you later want CIDR, that's a deliberate change (parse + match + test, staging-first) — offered as an option, not actioned.

### Consequences
Doc/dead-code cleanup: none to runtime. Enabling/altering enforcement could lock you (or cron/webhook callers) out if the IP source header differs in production — hence approval-gated.

---

## 4. Incomplete admin audit logging

### Finding
`recordAdminAction()` (`lib/command/audit/write.ts:15`) writes append-only `AdminAuditLog` rows (ESLint `no-admin-audit-mutation` blocks updates/deletes). **Logged today:** page views, auth (`totp_fail`/`step_up`/`enrolled`), `agency.close`/`agency.purge`, GDPR routes, all provider/quote actions, `outbound_message.viewed`, `view_as_start` (via `recordGodAction`). **Not logged:** content AI routes, logo/photo uploads, milestone/email-template/milestone-update edits, agent focus/photo writes, the AI kill-switch (`setAiEnabledAction`), platform-update publishing, and — most notably — the **destructive demo reset** (only a `console.info`).

### Actual risk
Medium, and it is a **hard prerequisite** for financial actions: you cannot have auditable refunds if the surrounding admin surface is half-logged.

### Proposed action (safe, additive, recommended first)
Add `recordAdminAction` calls to the unlogged mutations, with `beforeValue`/`afterValue` where meaningful. Priority order:
1. **Financial-adjacent / destructive:** demo reset, AI kill-switch, fee-tier changes, mark-free, retention pause. (These most need a trail.)
2. **Content-impacting:** milestone-email / email-template / milestone-update edits, bucket kill-switches, platform-update publish.
3. **Asset writes:** logo/photo uploads.

No signature change to `recordAdminAction` needed; these are additive calls. Each is independently verifiable (an `AdminAuditLog` row appears).

### Consequences
Purely additive — more rows in an append-only table. No behaviour change for users. One consideration: page-view logging is already high-volume; the new entries are per-mutation (low volume), so no material cost.

---

## 5. Safe implementation sequence

Phase 0 of the overall plan. Order chosen so each step is independently verifiable and the risky, approval-gated items come last.

1. **Audit coverage (finding 4)** — additive logging on unlogged mutations. *Safe. Verify: a row appears per action.*
2. **Unify hybrid detection (1b)** — single `isHybridSuperadmin` helper. *Safe, no behaviour change. Verify: layout/middleware/guard agree; existing access unchanged.*
3. **Documentation fixes (2, 3)** — CLAUDE.md `commandDb` truth; IP-allowlist 403/exact-match note; remove dead `config.ts` parse. *Safe.*
4. **`requireStepUp()` guard (finding 1)** — build the shared guard, wire it to the sensitive set, enable hybrid TOTP enrolment. ⛔ *Approval-gated (changes your flow). Verify on staging: sensitive action without fresh step-up is refused; with step-up succeeds; non-sensitive actions unaffected.*
5. **Held for separate approval:** any change to IP enforcement/CIDR, any `commandDb`/RLS change. Not in Phase 0.

### Rollback
- Items 1–3 are additive/doc-only — revert the commit.
- Item 4: the guard is additive; if a sensitive action is wrongly blocked, removing the `requireStepUp()` call on that action (or widening the window) restores prior behaviour without touching the auth core. The founder-TOTP enrolment is reversible (clear `totpActivatedAt`). Staging-first, one action at a time.

---

## 6. What I need from you

- **Approve finding 1's approach** — server-side step-up for sensitive financial/destructive actions applying to you too, with one-time TOTP enrolment. (Required before refunds.)
- **Confirm the "sensitive set"** — financial writes + destructive account actions + view-as. Include fee-tier/automation edits, or leave those step-up-free?
- **IP allowlist (finding 3)** — document-only for now (my recommendation), or do you want CIDR support built?
- **`commandDb` (finding 2)** — document-only for now (my recommendation); RLS is a future, separately-approved decision — agreed?

Nothing in §5 item 4 or §5 item 5 is built until you approve.
