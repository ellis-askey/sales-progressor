# Cutover plan — Model B email corpus

**Status:** draft, awaiting review. After sign-off, execute staging cutover → soak → production cutover.

**What's cutting over:** the 47-milestone Model B email corpus (`lib/email-skeletons/`) replaces the legacy flat-string copy (`lib/portal-copy.ts emailCopy`) as the source of client-facing milestone email content. tsc clean; voice-consistency sweep complete; production behaviour currently unchanged because `EMAIL_SKELETON_MODE` defaults off.

---

## 0. Pre-flight audit (completed 2026-05-27)

Before the staging cutover begins, a pre-flight audit verified that `confirmerRoute` and `handoffDirection` flow correctly from confirmation entry points through to `sendRichMilestoneEmails`. **Two bugs found and fixed in-line.**

### Bug A — agent/SP confirmation path didn't pass route/direction

**Found in:** [lib/services/portal.ts:782](lib/services/portal.ts#L782) (call to `sendRichMilestoneEmails` inside `sendAdminMilestoneNotificationToPortal`). Only 5 of 7 parameters passed; `confirmerRoute` and `handoffDirection` were both undefined at the callsite.

**Impact had this shipped:** Bilateral acted-side bodies (VM7/VM10/VM12/VM13/VM15 vendor; PM7/PM14/PM15/PM17/PM18 purchaser) have ONLY route-conditional Section entries for subject + opening. With `route: undefined`, no Section matched → assembled subject and opening would both be empty strings. Email would have gone out with no subject line and starting directly with "Hi Alex," + body. Similarly, bilateral default- and inverse-direction nudges have ALL their Section entries gated on direction; with `direction: undefined`, every field would have been empty → completely empty assembled email.

**Fix applied (this session):**
- Added `BILATERAL_PAIR_OF` map to [lib/email-skeletons/journey-order.ts](lib/email-skeletons/journey-order.ts) — symmetric pair lookup for the 5 bilateral pairs.
- Added `computeHandoffDirection()`, `isBilateralCounterpartComplete()`, `roleToConfirmerRoute()` helpers to [lib/services/portal.ts](lib/services/portal.ts).
- Extended `sendAdminMilestoneNotificationToPortal` signature to accept `confirmerRoute` + `handoffDirection`; passes through to `sendRichMilestoneEmails`.
- Both callsites in [app/actions/milestones.ts](app/actions/milestones.ts) (`confirmMilestoneAction` + `reconcileMilestoneAction`) now compute the route from `session.user.role` and the direction from counterpart-complete state, passing both through.

### Bug B — client-portal confirmation path bypassed Model B entirely

**Found in:** [lib/services/portal.ts:577-628](lib/services/portal.ts#L577) — `logPortalMilestoneConfirm` was reading copy directly via `richCopy[recipientKey]` instead of going through `resolveRecipientCopy`. The entire portal-confirm email pipeline never touched the assembler — would have continued sending legacy `emailCopy` even with `EMAIL_SKELETON_MODE=on`.

**Impact had this shipped:** The ψ menu of bilateral client_portal-route openings — the 12 placements I authored explicitly for the "client confirmed via their own portal" register — would never have fired in production. Every client-portal milestone confirmation would have sent legacy copy regardless of the flag state. On the £59-tier self-managed files (where clients confirm their own milestones), Model B would have been silently dead.

**Fix applied (this session):**
- Added `tenure` + `purchaseType` to the tx query in `logPortalMilestoneConfirm`.
- Construct a `portalFileShape: FileShape` with `route: "client_portal"` + computed direction. Strict no-op when flag is off or tenure/purchaseType are null.
- Replaced `richCopy[recipientKey]` with `resolveRecipientCopy(milestoneCode, recipientKey, richCopy, portalFileShape)`.

### Audit conclusion

Both bugs were silent failures — the no-op contract held perfectly (flag off → legacy copy), so neither would have surfaced until someone flipped the flag and a bilateral milestone was confirmed. The staging soak would have failed confusingly, exactly as predicted, with one of:
- (a) An email landing with no subject and an opening missing
- (b) An email landing with default-direction-conditional content for a milestone where direction wasn't passed
- (c) A client portal confirm sending legacy copy when the verification expected Model B

All three failure modes are now wired correctly. tsc clean after fixes. The staging soak should now produce clean signal — either Model B fires correctly, or there's a real bug elsewhere.

---

## 1. How `EMAIL_SKELETON_MODE` flips on

**It's a runtime env var.** Read at every email send via `isSkeletonModeEnabled()` in [lib/email-skeletons/registry.ts:119](lib/email-skeletons/registry.ts#L119):

```ts
export function isSkeletonModeEnabled(): boolean {
  return process.env.EMAIL_SKELETON_MODE === "on";
}
```

The function is called inside [`sendRichMilestoneEmails()` at lib/services/portal.ts:1071](lib/services/portal.ts#L1071) when constructing the `FileShape`:

```ts
const fileShape: FileShape | null =
  isSkeletonModeEnabled() && tx.tenure && tx.purchaseType
    ? { tenure, purchaseType, route, direction }
    : null;
```

If `EMAIL_SKELETON_MODE=on` AND the transaction has both `tenure` and `purchaseType` set, the assembler path activates for that send. Otherwise `resolveRecipientCopy()` falls through to legacy `emailCopy[recipientKey]`.

**The flag flip itself:** change the env var value in the Vercel project's Environment Variables panel. **No redeploy required** — `process.env` is read at each invocation, so the change is picked up by the next email send within seconds. The same is true in reverse — flipping it back to `off` (or removing it) instantly returns to legacy behaviour.

**Three load-bearing guards** ensure the no-op contract holds (`resolveRecipientCopy` at [lib/services/portal.ts:1003-1028](lib/services/portal.ts#L1003)):
1. `EMAIL_SKELETON_MODE === "on"` must be true (otherwise `shape` is null → legacy path).
2. The milestone code must exist in `SKELETON_REGISTRY` (otherwise fall through per-recipient → legacy path).
3. `tx.tenure` and `tx.purchaseType` must both be non-null (otherwise `shape` is null → legacy path).

All three must be true for the assembler to fire. If any fail, the legacy email path is used and the reader gets the same email they would have got pre-cutover.

---

## 2. Staging verification steps

**Where:** the staging Vercel project, hitting the staging Supabase DB (project id `etidawkbqctarmsdjoxp`).

**Test inbox:** `ellisaskey+modelb@googlemail.com` (Gmail + aliasing). Auto-files into a Model B test folder so verification emails are isolated from real inbox traffic. Real customer emails on staging keep landing on `ellisaskey@googlemail.com` — the alias ensures clean signal during the soak. Set up the Gmail filter (matching to:`ellisaskey+modelb@googlemail.com`) to auto-label "Model B test" and skip the inbox if preferred. Configure test transactions to use the aliased address for vendor + purchaser contacts.

### Step-by-step

1. **Confirm staging deploy is up-to-date.** Latest commit on `staging` branch includes all 47 authored skeletons + cluster fixes + temporal-order fixes + voice sweep + **bilateral route plumbing fix (pre-flight finding, 2026-05-27)**. Visible in [lib/email-skeletons/registry.ts](lib/email-skeletons/registry.ts) — all 47 entries listed. Pre-flight audit details in Section 0 below.

2. **Pre-flag check (proves no-op).** Before flipping the flag, fire a milestone confirmation on a test transaction. Confirm the email arrives at `ellisaskey+modelb@googlemail.com` and reads **exactly as the legacy `emailCopy`** — this proves production behaviour will be unchanged after deploy + before flag-flip.

3. **Flip flag on staging.** Vercel dashboard → staging project → Settings → Environment Variables → add `EMAIL_SKELETON_MODE` = `on` for the preview/staging environment. Save. **No redeploy.**

4. **Create or pick four test transactions covering the shape matrix.** At minimum two shapes:
   - **Leasehold × mortgage** (the fullest path — every milestone fires, no shape-suppression)
   - **Freehold × cash buyer** (a different shape entirely — most condition-key branches go the other way)

   On real verification day, also walk through:
   - **Leasehold × cash from proceeds** (densest shape, where most paragraph add-ons co-fire)
   - **Freehold × mortgage** (the most common real-world shape on the platform today)

   Each transaction needs `tenure` and `purchaseType` set on creation (otherwise `shape` is null and the assembler doesn't fire).

5. **Walk each test transaction through several milestones.** Recommended sequence to hit the key code paths:
   - **VM1 + PM1** — non-bilateral, simple ack
   - **VM7 (default direction)** — bilateral first-actor with 3 route variants + leasehold conditioning. Trigger via the seller-portal confirm to test `route: "client_portal"`; trigger via the agent dashboard to test `route: "agent"`.
   - **PM7** — bilateral second-actor on default direction (silence note for vendor, route-varied ack for purchaser)
   - **PM5** on a cash transaction — should NOT fire (auto-NR suppression). Confirm no email lands.
   - **PM5** on a mortgage transaction — should fire correctly.
   - **VM8/VM9/PM12** on a leasehold transaction — three-event arc; check the trimmed whatHappened sections (VM11/VM12/VM14/VM15 family) read clean.

6. **Verify on each rendered email:**
   - **Subject** matches the registered skeleton (cross-reference [docs/active/email-snapshots/](docs/active/email-snapshots/) per-milestone files).
   - **Body** matches the snapshot for the test transaction's `(tenure, purchaseType, route, direction)`.
   - **Shape conditioning** fires correctly — e.g. on freehold × mortgage, leasehold paragraphs do NOT appear and the mortgage funding-tail DOES.
   - **Suppression notes do not fire as content** — if the test transaction is cash-buyer and you trigger PM5, no email arrives at all (NOT an email containing the suppression text). The suppression note is only for the snapshot tooling.
   - **No rendering errors** in Vercel function logs — `assembleEmail()` is pure and shouldn't throw, but watch for any `Cannot read property 'X' of undefined`-style errors that would indicate a corrupted skeleton or shape.
   - **Greeting + signature + action link** survive — the assembler only replaces subject/heroLabel/opening/whatHappened/whatNext/action; the surrounding email scaffolding from `sendRichMilestoneEmails` should be intact.

7. **Toggle-back test on staging.** Flip `EMAIL_SKELETON_MODE` back to `off` (or remove the variable). Within seconds, the next milestone confirmation should send the legacy email. This proves the rollback path works **before** going to production. Then flip back to `on` and continue to the soak window.

8. **Soak window — 2 hours of staging running with `EMAIL_SKELETON_MODE=on` and no issues.** This is the **stop signal** — the criterion for "staging is soaked, ready to ship to prod." Long enough that any deferred-fire or async issues have time to surface (cron jobs, reminder cascades, batch sends, anything that lags behind the synchronous confirm path); short enough not to consume the day.

   **"No issues" means, across the full 2-hour window:**
   - No Vercel function log errors tagged from `lib/services/portal.ts` or `lib/email-assembler/*`.
   - No literal placeholder text (`{address}`, `{First}`, `{eventDate}`, `{eventDateClause}`, `{vendorVisitNote}`, `{purchaserPhysicalNote}`) appearing in any sent email body.
   - No assembled email lands with an empty subject, empty opening, or empty whatHappened — these indicate the assembler returned nothing for a route or direction Section that should have matched.
   - No milestone confirmation results in zero emails sent (when emails were expected) — would indicate a hard failure in the assembler path.
   - No SendGrid bounces or rejects clustering on this window beyond baseline.
   - Manual spot-check of at least 6 rendered emails (across the 4 shape combinations + the bilateral acted-side route variants) confirms each matches the snapshot for its (tenure, purchaseType, route, direction).

   **Stop signal is criteria-based, not exhaustion-based.** If all 6 bullets hold after 2 hours, staging is soaked. If any bullet fails, investigate the cause before going to prod — don't proceed on the assumption that "it probably resolved itself."

   During the window, watch for the failure modes listed below — these are what the 6 bullets above are designed to catch:
   - Any milestone confirmation triggering an email that doesn't arrive (could indicate `assembleEmail` returning empty fields → email send aborted).
   - Any email that arrives with one of the placeholder vars unsubstituted (would indicate a missing interpolation key — see PM6's `{eventDateClause}` / `{vendorVisitNote}` / `{purchaserPhysicalNote}` runtime placeholders).
   - Any Vercel function log error tagged from `lib/services/portal.ts`.

---

## 3. Order of operations to production

### Recommendation: deploy-first, flag-flip-second. No staged-rollout gating.

**Why not single combined deploy with the flag set:** if anything goes wrong post-deploy (skeleton-related OR unrelated), the rollback requires a full redeploy of the prior commit instead of a single env-var change. Deploy + flag-flip as separate steps gives us a one-action rollback for the flag-flip itself.

**Why not flag-flip-then-deploy:** the skeleton code isn't on production yet — the staging branch hasn't been merged to master. Flipping the flag in Vercel production env before the deploy doesn't enable anything (the registry is empty in prod) and means we couldn't sanity-check the post-deploy no-op state.

**Why not a staged % rollout:** the codebase has no per-transaction percentage gating on the flag — adding one would require touching `resolveRecipientCopy` to read a separate env var or compute a hash of `transactionId`, which is real code work and adds a moving piece. Given:
- The platform has ~5 active test users (low volume).
- The no-op contract is robust (3 guards in `resolveRecipientCopy`).
- Rollback is a single env-var flip with no redeploy.

…a big-bang flag-flip is safer than introducing percentage gating code that itself hasn't been tested.

### Production cutover sequence

1. **Pre-flight:**
   - Confirm staging soak passed (Step 7 + 8 above).
   - Confirm `EMAIL_SKELETON_MODE` is **not set** (or set to `off`) on the Vercel production environment. Verify this before deploy.

2. **Deploy:**
   - Merge `staging` → `master`.
   - Push triggers the Vercel production deploy.
   - Wait for deploy success indicator.

3. **Post-deploy no-op check:**
   - Trigger a milestone confirmation on a real (or test) production transaction.
   - Verify the email arrives **with legacy `emailCopy` content**, not assembled-from-skeleton.
   - This proves the post-deploy, pre-flag-flip state is the strict no-op.
   - **If this check fails** — i.e. an assembled email arrives despite the flag being off — STOP, do not flag-flip, investigate. The no-op contract has a hole.

4. **Flag flip:**
   - Vercel dashboard → production project → Settings → Environment Variables.
   - Add or update `EMAIL_SKELETON_MODE` = `on` for the Production environment.
   - Save. **Do not redeploy.**
   - Within seconds, the next milestone confirmation will use the assembler.

5. **Smoke test on production:**
   - Trigger a milestone confirmation on a test transaction (any shape).
   - Verify the email arrives with assembled-from-skeleton content (cross-check against [docs/active/email-snapshots/](docs/active/email-snapshots/) for the matching shape).
   - **If this check fails** — proceed to rollback (Section 4) immediately.

6. **Soak window:** see Section 5.

---

## 4. One-action rollback

**If a real production email looks wrong any time after cutover:**

Vercel dashboard → production project → Settings → Environment Variables → change `EMAIL_SKELETON_MODE` from `on` to `off` (or delete the variable). Save.

**That's it.** The next email send (within seconds) returns to legacy `emailCopy`. No redeploy, no code revert, no DB migration.

The Vercel CLI equivalent if you prefer the command line:

```bash
vercel env rm EMAIL_SKELETON_MODE production
# or
vercel env add EMAIL_SKELETON_MODE off production
```

**Why this works:** [lib/services/portal.ts:1071](lib/services/portal.ts#L1071) reads `process.env.EMAIL_SKELETON_MODE` on every call to `sendRichMilestoneEmails`. The Vercel function runtime picks up env-var changes from the dashboard live — typically within a few seconds, sometimes immediately. No deploy is required to apply the change.

**Validation after rollback:** trigger a test milestone confirmation immediately after the flip. Verify the email arrives as legacy `emailCopy` content. If it does, rollback is confirmed clean. If it doesn't, escalate — there's a deeper issue than the flag.

**Note:** rolling back via flag-flip means any new emails return to legacy copy. Emails that already sent during the broken period are out the door — they can't be unsent. The flag-flip stops new bad emails but doesn't fix sent ones.

---

## 5. First-hour monitoring window

**Window length:** 1 hour minimum, ideally 2–3 hours of real-world activity.

**Where to watch:**

### Vercel function logs (Vercel dashboard → production project → Logs)

Specifically the function that hosts `sendRichMilestoneEmails`. Filter for errors tagged from `lib/services/portal.ts`. Watch for:
- **`assembleEmail` exceptions** — would indicate a malformed `MilestoneSkeleton` Section[] or an invalid `ShapeCondition`. The assembler is pure and shouldn't throw on valid input; if it does, the registry has a bug.
- **`resolveRecipientCopy` returning undefined unexpectedly** — would indicate a milestone code that exists in `SKELETON_REGISTRY` but has a recipient mismatch (e.g. asking for `vendor` on a skeleton with no vendor body, like PM16 / PM19).
- **Interpolation errors** — literal `{address}`, `{First}`, `{eventDate}`, `{eventDateClause}`, `{vendorVisitNote}`, `{purchaserPhysicalNote}` appearing in sent email bodies. The interpolation map is built in `sendRichMilestoneEmails`; any new placeholder I introduced in the skeletons needs to be in the var map.

### SendGrid send logs (SendGrid dashboard → Activity)

Watch for:
- **Bounces or rejects** clustering on the cutover window — would indicate a malformed subject line (e.g. unsubstituted placeholders) hitting SendGrid's filters.
- **Send volume** matching expected — if no emails are sending at all after cutover, the flag-flip may have broken the send path entirely.
- **Spam complaints** — assembler-rendered content should look natural; if a client flags an email as spam during the soak, read what landed and check whether the assembler produced something off.

### What to look at on actual rendered emails

For at least the first 2–3 milestone confirmations that fire after cutover:
- **Open the email** in the recipient's inbox (or send it to a known test inbox like `ellisaskey@googlemail.com` first).
- **Compare against the snapshot** in `docs/active/email-snapshots/<CODE>.md` for the matching shape.
- **Look specifically for:** subject correctness, body matches expected shape conditioning, no truncated paragraphs, no literal placeholder text, action link works.

### Specific gotchas given how the assembler is wired

- **`tx.tenure` or `tx.purchaseType` null on a real production transaction** — the assembler will fall through to legacy, NOT throw. Watch for emails that arrive as legacy copy when you expected assembled (indicates the transaction's shape is incomplete).
- **Bilateral milestones with no `confirmerRoute` passed** — when `confirmMilestoneAction` calls `sendRichMilestoneEmails`, it should pass `confirmerRoute` (`client_portal` / `agent` / `sales_progressor`) for bilateral acted-side milestones. If it doesn't, the `route` field in `FileShape` is undefined, and the route-conditional Section entries won't match → openings could come out without their route-varied wording. Check the bilateral renderings specifically (VM7/PM7/VM10/PM14/VM12/PM15/VM13/PM17/VM15/PM18).
- **`handoffDirection` mis-passed** — the inverse-direction nudge bodies should only fire when the bilateral order is unnatural. If `handoffDirection` is mis-passed as `"inverse"` when it shouldn't be, the wrong body fires.

### When to escalate vs continue watching

- **Continue watching** if: no errors, emails landing as expected, no spam complaints.
- **Roll back immediately** if: an email arrives with literal placeholder text (e.g. `{address}` un-substituted), or function logs show repeated `assembleEmail` exceptions, or send volume drops to zero after the flip.
- **Investigate without rolling back** if: one email looks slightly off but isn't broken (e.g. a wording choice feels wrong). Document it, watch the next few, decide whether to roll back based on pattern.

---

## Appendix — corpus state at cutover

- **47 milestones authored.** Full inventory in [lib/email-skeletons/registry.ts](lib/email-skeletons/registry.ts).
- **6 per-shape journey docs + 47 per-milestone snapshots** in [docs/active/email-snapshots/](docs/active/email-snapshots/). Reference these during verification.
- **Voice-consistency sweep complete.** Catalogue + menus archived at [voice-sweep-catalogue.md](docs/active/email-snapshots/voice-sweep-catalogue.md) and [voice-sweep-menus.md](docs/active/email-snapshots/voice-sweep-menus.md).
- **tsc clean.**
- **`EMAIL_SKELETON_MODE` defaults off.** Production behaviour unchanged until the flag flips.

---

**Ready for review.** When approved, execute Section 2 (staging) → soak → Section 3 (production).
