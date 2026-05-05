# Chain Feature — Documentation

Specs for the chain visibility and collaboration feature. Place this entire folder in `docs/chain-feature/` at the root of the repo.

## How to use

1. Drop the folder into `docs/chain-feature/` in the repo root
2. Open `IMPLEMENTATION-PROMPT.md`, copy its full contents, paste into Claude Code
3. Claude Code reads the docs in the order specified and implements in chunks
4. Each chunk is a separate commit — revert any chunk independently if it breaks something
5. Run on local `:3000` and iterate

## Document index

| File | Purpose |
|---|---|
| `00-overview.md` | What we're building, scope, principles |
| `01-data-model.md` | Prisma schema changes |
| `02-permissions.md` | Permission matrix and enforcement |
| `03-add-sale-integration.md` | Chain section on new transaction page |
| `04-view-chain-drawer.md` | View Chain drawer (replaces existing widget) |
| `05-add-node-drawer.md` | Add/edit node form |
| `06-invite-flow.md` | Invite email and send logic |
| `07-claim-flow.md` | Claim landing/signup/login/confirm |
| `08-copy.md` | Every user-facing string |
| `09-stability-guarantees.md` | What gets touched, what doesn't, regression checklist |
| `10-deferred.md` | What's NOT in v1 (withdraw cascade, decouple, etc.) |
| `IMPLEMENTATION-PROMPT.md` | The prompt to give Claude Code |

## After Claude Code runs

When you've tested on local and have feedback, send the feedback back. We'll iterate by either:

- Updating the relevant spec doc and re-running CC on that chunk only
- Or generating a focused refinement prompt for CC for a specific issue

Keep the docs versioned in git alongside the code so you have a trail of what was specified at implementation time.
