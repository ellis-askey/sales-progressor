# Incident — 2026-06-04 credential exposure

> One-page incident record. Lives here until the prod GO/NO-GO gate (see [relist-feature/prod-release-runbook.md](relist-feature/prod-release-runbook.md)) closes; then promotes to `docs/done/incidents/` alongside the post-mortem section completed.

## What leaked

Production Postgres superuser connection string, with the password inlined:

```
postgresql://postgres:Talia-2021!!@db.gmkfustgwipgihpmpjpr.supabase.co:5432/postgres
```

Host `gmkfustgwipgihpmpjpr.supabase.co` is the prod Supabase project per CLAUDE.md. The `postgres` role is the database superuser — full read + write + DDL on all prod data.

## Where it leaked

- **Repo:** `ellis-askey/sales-progressor` (public on GitHub).
- **File:** `.claude/settings.local.json` — a Claude Code permission allowlist that recorded earlier `prisma db push`, `db:seed`, and `prisma db execute` invocations with `DATABASE_URL=...` inlined on the Bash command line.
- **Introduced:** initial commit `8d4d4354`, **2026-04-21**.
- **Exposure window:** **44 days**, 2026-04-21 → 2026-06-04 (scan date).
- **Discovered:** 2026-06-04, manual pattern pass for `postgresql://[^:]+:[a-zA-Z0-9]{8,}@` during the post-`b700fa7` security audit triggered by an earlier finding (the staging password commit).

## Why it landed

Claude Code's permission allowlist files (`.claude/settings.json` and `.claude/settings.local.json`) capture the literal Bash command strings the operator pre-approves. Several early `prisma db push` invocations had the prod `DATABASE_URL` inlined rather than read from a sourced env file. Those exact commands were recorded into the allowlist verbatim, and the allowlist was committed alongside the initial app code. No gitignore rule covered the file at that time.

The category fault — Claude Code allowlist files being committable in the first place — was the underlying gap, not a one-off mistake. The fix has to be at the category level.

## Remediation timeline

| Time (UTC) | Step | Status |
|---|---|---|
| 2026-06-04, scan complete | Discovered the leak via manual pattern pass | ✓ |
| 2026-06-04, commit `1324e3f` | `.claude/settings*.json` added to `.gitignore` + `git rm --cached`'d. Local copies preserved on disk; future commits cannot pick them up. | ✓ |
| 2026-06-04, commit `cde829d` | Pre-push gitleaks hook installed at category level. Any future commit / push with a finding fails the operation. | ✓ |
| Ellis lane | Rotate the prod Supabase Postgres superuser password. | ☐ Pending, timestamp: __TBD__ |
| Ellis lane | Update Vercel env vars (`DATABASE_URL` + `DIRECT_URL`) for Production + Preview, redeploy. | ☐ Pending, timestamp: __TBD__ |
| Ellis lane | Repo visibility decision (flip private / record decision to remain public). Verified `2026-06-05T09:30Z` via unauthenticated `https://api.github.com/repos/ellis-askey/sales-progressor` → `"private": false`. Repo IS STILL PUBLIC. Decision unrecorded. | ☐ Pending, timestamp: __TBD__ |
| Ellis lane | Third staging password rotation (so no AI-visible values exist). | ☐ Pending, timestamp: __TBD__ |
| Post-rotation | Append the four second-rotation staging values to `KNOWN_WEAK_PASSWORDS` in `scripts/prod-check-weak-credentials.ts`. NOT before the rotation lands — active values never go on the burn list (invariant in that file). | ☐ Pending |
| 2026-06-05, CC reconciliation | Marketing-site repo location confirmed; scan executed if any public repo backs it. **Location:** local-only directory at `c:\Users\ellis\Downloads\Sales Prog App\marketing-site\`, sibling to the main app repo. **Not a git repository** (no `.git/`, no remote configured). Vercel-linked via project `prj_K4OBGqE16RXKiLhlLJZRjDi8rRkn` (team `team_X1VHOhasSVDrgzRotdlUl13A`, project name `marketing-site`) — deploys are CLI-only, no GitHub integration → no public git history exposure. **Scan result:** manual pattern pass clean against `*.{ts,tsx,js,jsx,json,md,yml,yaml,toml,html}` + `.env*` files (excluding `node_modules`, `.next`, `.vercel`), matching `postgresql://…` / `SG\.…` / `AKIA…` / `sk_live_…` / `ghp_…` / `xox[bp]-…` / `BEGIN … PRIVATE KEY` / JWT shapes — zero hits. No `.env*` files at the top level. | ✓ 2026-06-05 |
| Ellis lane | Supabase log review: any anomalous connections from non-Vercel / non-Ellis IPs during the 44-day window. | ☐ Pending, outcome: __TBD__ |

## Guardrails shipped as a result of this incident

These are the category-level fixes that hold after the incident closes:

1. **`.claude/settings*.json` is gitignored**. Future commits cannot re-leak through this channel. Commit `1324e3f`, with an explanatory comment in `.gitignore` pointing at this incident so the rule does not get accidentally undone.
2. **Pre-push gitleaks hook**. Any commit / push containing a credential pattern fails the operation before reaching the remote. Installed via `.git/hooks/pre-push`, with `scripts/install-gitleaks-hook.sh` for reproducible setup. Covers SendGrid, Stripe, AWS, Azure, GCP, Postgres URLs with real-looking passwords, generic high-entropy strings, JWTs, the full gitleaks default ruleset.
3. **Prod credential gate in the release runbook**. `scripts/prod-check-weak-credentials.ts` runs at Step 8 of every prod deploy. Compares every prod `User.password` hash against the `KNOWN_WEAK_PASSWORDS` burn list. Catches re-use of any historically-leaked or post-rotation value.
4. **Password-manager-only rule**. `docs/test-accounts.md` no longer carries passwords. All staging credentials live in Ellis's password manager. The rotation script's stdout warning enforces the rule at the moment of rotation.
5. **Hard PROD GO/NO-GO gate**. The runbook now blocks prod cutover on five named confirmations (see runbook §0 gate). Build can finish on staging; nothing touches prod while any are open.

## Open security questions (pending Ellis's lane)

- [ ] Has the prod Postgres password been rotated? Timestamp: __TBD__
- [ ] Has the repo been flipped private? Decision + timestamp: __TBD__
- [ ] Supabase log review for the 44-day window — anomalous connections seen? __TBD__ (expected: none, given operator-only key)
- [x] Marketing-site source location confirmed and scanned where applicable: **local-only, no git remote, no public exposure; pattern scan clean** — CC closed 2026-06-05.

## Override sign-off (2026-06-05) — gates 1, 2, 3, 5 explicitly WAIVED

The four open gates — prod Supabase password rotation + Vercel env update + redeploy (gate 1), repo visibility decision (gate 2), third staging rotation by Ellis personally + KNOWN_WEAK_PASSWORDS extension (gate 3), and the substantive incident-record completion (gate 5) — were not cleared before the buyer-round prod cutover.

Ellis posted the following waiver in chat on 2026-06-05:

> **Override: I waive runbook gates 1, 2, 3, 5 and authorise prod deploy on current credentials. Accept the credential-exposure risk. Sign-off: Ellis, 2026-06-05.**

Operational reality at the moment of override:
- Prod Supabase Postgres password still the original (leaked in `8d4d4354`, exposed 2026-04-21 → 2026-06-04 in `ellis-askey/sales-progressor` public history).
- Repo verified public at `2026-06-05T09:30Z` via unauthenticated GitHub API (`"private": false`).
- Second-rotation staging values are still ACTIVE on staging — not yet retired by a third rotation, so not yet on the `KNOWN_WEAK_PASSWORDS` burn list.
- Supabase log review for the 44-day exposure window — not performed.

The buyer-round prod cutover proceeded under this override.

## Sign-off

Ellis sign-off (override path): **2026-06-05**, per the chat-recorded override above.

This record stays in `docs/active/` for the duration of the 24h prod-monitoring window after cutover. After the window closes — or earlier if Ellis chooses to clear the substantive gates retroactively — it promotes to `docs/done/incidents/`.

---

## Lessons (one-paragraph, written 2026-06-04)

Two: **(a)** Claude Code allowlist files are config-as-credential-history; they need the same gitignore + scan treatment as `.env`. **(b)** "Confirm before act" applies hardest to assumptions that feel obvious — repo visibility, file-is-template-status, the assertion class. The string `private: false` in a one-liner API response would have stopped both the staging password commit and the original allowlist commit. The pre-push hook lands that check in the tool, not the operator.
