# Discovery report: Roles and permissions

_Temporary file — delete after article is written._

---

## 1. Roles in schema

**File:** `prisma/schema.prisma` lines 110–117

UserRole enum values:
- `superadmin` — internal Sales Progressor staff (OUT OF SCOPE)
- `admin` — internal Sales Progressor staff (OUT OF SCOPE)
- `sales_progressor` — internal Sales Progressor staff (OUT OF SCOPE)
- `director` — agency user (IN SCOPE)
- `negotiator` — agency user (IN SCOPE)
- `viewer` — read-only state; used as a soft-delete/deactivated state, not an active role (see section 8)

**Per-user flags on User model:**
- `role: UserRole @default(viewer)` (line 55)
- `canViewAllFiles: Boolean @default(false)` (line 62) — modifies negotiator file visibility (see section 4)
- `hasSeenAgentWelcome: Boolean @default(false)` (line 63) — onboarding state only, no permission effect
- No other boolean flags modify role behaviour

---

## 2. Navigation and sidebar visibility

**File:** `components/layout/AgentShell.tsx` lines 20–35

- All nav items visible to both roles: Hub, Reminders, Completions, To-Do, Updates, Analytics, Solicitors, Settings
- One label difference: transaction list labelled **"All Files"** for directors, **"My Files"** for negotiators (UI label only — underlying route is the same)
- No nav items are hidden from negotiators at the sidebar level
- Director-only UI is gated inside Settings (see section 3), not at the nav level

---

## 3. Account-area sections and role gates

The legacy `/agent/settings` page was retired in May 2026 and replaced with the Account area at `/agent/account/{billing,profile,team,notifications}`. The old URL 301-redirects to `/agent/account/profile`.

**Files:**
- Layout + nav: `app/(account)/layout.tsx`, `components/account/chrome/AccountLeftNav.tsx`
- Tabs: `app/(account)/agent/account/{billing,profile,team,notifications}/page.tsx`

| Tab | Role access | Per-page gate |
|---|---|---|
| Profile (my profile, sending addresses, branch theme, account danger zone) | All roles | None — both director and negotiator visible in nav |
| Notifications (email prefs, mobile push, silenced files) | All roles | None |
| Billing (running total, invoice history, payment method, plan & terms) | **Director only** | `notFound()` for non-directors |
| Team (roster management for director; invite-director for negotiator-no-director) | **Director** always; **Negotiator** visible only when agency has no director | Nav conditionally hides for negotiators-with-director; page `notFound()`s for them |

- Negotiators landing on the bare `/agent/account` redirect to their first visible tab (Profile)
- Directors landing on the bare `/agent/account` redirect to Billing (their first tab)
- Per-role tab visibility computed in `components/account/chrome/AccountLeftNav.tsx`

---

## 4. canViewAllFiles flag

**Schema:** `prisma/schema.prisma` line 62 — `canViewAllFiles: Boolean @default(false)`

**Where read:**
- `lib/services/agent.ts` — `resolveAgentVisibility()`: `const seeAll = user?.role === "director" || user?.canViewAllFiles === true`
- `app/agent/dashboard/page.tsx` lines 23–25 — uses `resolveAgentVisibility()` to determine query scope
- `app/api/agent/notifications/route.ts` lines 11–16 — same pattern

**Where set:**
- `app/api/agent/team/[id]/route.ts` PATCH handler — director-only; updates `canViewAllFiles: Boolean(canViewAllFiles)`
- `components/agent/TeamManagement.tsx` lines 33–44 — director toggles per negotiator; calls `PATCH /api/agent/team/{id}`

**JWT / session:** `canViewAllFiles` is **not in the JWT token**. Token carries only `id, role, agencyId, firmName, needsSignupCompletion` (`lib/auth.ts` lines 35–42). The flag is queried fresh from the database on each request via `resolveAgentVisibility()`.

**Effective timing:** Takes effect on the negotiator's **next request** — no sign-out required.

**What enabling it changes:**
- Negotiator's transaction list query changes from `{ agencyId, agentUserId: self }` to `{ agencyId, agentUserId: { not: null } }` (same as director)
- Identical to director visibility — all agent-created files in the agency, not scoped by file type, status, or assignment

---

## 5. Transaction / file visibility query

**File:** `lib/services/transactions.ts` lines 7–22 — `listTransactions()`

| Who | Query scope |
|---|---|
| Director | `{ agencyId, agentUserId: { not: null } }` — all agent-created files in agency |
| Director with firmName | `{ agencyId, agentUser: { firmName: "..." } }` — files by agents in same firm |
| Negotiator, `canViewAllFiles: false` | `{ agencyId, agentUserId: self }` — own files only |
| Negotiator, `canViewAllFiles: true` | Same as director |

`resolveAgentVisibility()` (`lib/services/agent.ts`) determines which branch is used; called by dashboard and any page that lists transactions.

---

## 6. API-level director-only enforcement

All gated by `requireDirector()` helper which returns 403 if `session.user.role !== "director"`.

| Route | Method | What it does |
|---|---|---|
| `app/api/agent/team/route.ts` | GET | List team members (`role: { in: ["director", "negotiator"] }`) |
| `app/api/agent/team/route.ts` | POST | Create negotiator account (always `role: "negotiator"`) |
| `app/api/agent/team/[id]/route.ts` | PATCH | Update negotiator's `canViewAllFiles` only |
| `app/api/agent/team/[id]/route.ts` | DELETE | Soft-remove team member (sets `role: "viewer"`) |

**Viewer mutations:** `middleware.ts` lines 134–143 — any `POST/PUT/PATCH/DELETE` to `/api/` by a viewer returns 403 "Viewers cannot make changes."

---

## 7. Role assignment at signup

**Initial registration:** `app/register/page.tsx` + `app/api/register/route.ts`

- Step 2 of signup offers radio buttons: Director or Negotiator (default: Director)
- User-chosen role submitted to `/api/register` → `role: role === "director" ? "director" : "negotiator"`
- `createDirectorWithAgency()` (`lib/auth/create-director-with-agency.ts` lines 29–77) is called for **both** roles — creates a new Agency and sets `agencyId` regardless of chosen role

**Unclear:** A negotiator who self-registers gets their own agency created, making them effectively an account owner with no team management capability. This appears to be a bug or unintended path — negotiators should not be able to self-register.

**OAuth signup:** `app/actions/complete-oauth-signup.ts` — same `createDirectorWithAgency()` call; role chosen during OAuth completion step.

**Adding via team management:**
- Director calls `POST /api/agent/team` with `name, email, password`
- Always creates `role: "negotiator"` — director cannot choose the role (line 60)
- No email invitation sent — director must share credentials manually

---

## 8. Role changes after signup

**No API route exists to change a user's `role` between `director` and `negotiator`.** Only transitions available:

| Action | Effect | Who can do it |
|---|---|---|
| `DELETE /api/agent/team/[id]` | Sets target's role to `"viewer"` | Director only |
| N/A | Promote negotiator to director | **Not possible** |
| N/A | Demote director to negotiator | **Not possible** |

- Self-removal blocked: `if (id === session.user.id) return 400` (`app/api/agent/team/[id]/route.ts` line 49)
- Can only DELETE a negotiator, not a director: `role: "negotiator"` guard on line 54

---

## 9. Pending invitations

**No Invitation model exists in the schema.** There is no invitation-based team member flow.

Team members are added by directors creating accounts directly (name, email, password). No invitation email is sent. No pending state exists.

**ChainLink invite fields** (`prisma/schema.prisma` lines 719–725) — these exist in the schema but are for multi-agency property chain invitations (Project B), not team member invitations. Not relevant here.

---

## 10. Removing users

**File:** `app/api/agent/team/[id]/route.ts` DELETE handler, lines 41–64

- Director only
- Self-removal blocked (returns 400)
- Target must be a negotiator in the same agency (not a director)
- **Soft delete only:** sets `role: "viewer"` — account not deleted
- Viewer can still log in; can read data but cannot mutate anything

**What happens to their files:**
- Files (`agentUserId = removed_user_id`) remain in the database
- Directors can still see them (all-files query includes `agentUserId: { not: null }`)
- Other negotiators with `canViewAllFiles` can see them
- Negotiators without `canViewAllFiles` cannot see them (those files are no longer in `{ agencyId, agentUserId: self }`)
- Files not reassigned, not deleted

**What happens to notes / activity history:**
- All records remain; attributed to the original user
- No anonymisation

**UI confirmation:** `TeamManagement.tsx` line 47 — `confirm()` dialog shown before deletion. No email sent to removed user.

---

## 11. Multi-director behaviour

- No upper limit on directors per agency in schema or any API route
- No "primary director" or "account owner" distinction — all directors are equal
- No last-director constraint in the DELETE handler (only `role: "negotiator"` is required for deletion — **a director cannot be deleted by another director via the team API**)
- Directors cannot remove other directors (DELETE only accepts negotiator targets)
- Directors cannot remove themselves (self-removal blocked)
- **Effective result:** It is impossible to remove a director via the current UI. Directors can only be soft-removed by changing their role — which no API route supports. An agency can never be left with zero directors through the current UI.

---

## 12. OAuth / needs-signup-completion flow

**File:** `lib/auth.ts` lines 148–177

- OAuth user first lands as `role: "viewer"`, no `agencyId`
- JWT callback sets `needsSignupCompletion: true` when `role === "viewer"` and no `agencyId`
- Middleware redirects to `/signup/complete` until agency is created and role is set
- Flag rechecked on every JWT refresh — clears automatically once `agencyId` is set in DB
- Applies to Google and Microsoft (Azure AD) OAuth providers

---

## 13. Worth flagging

1. **Negotiators can self-register and create their own agency.** The signup flow offers "Negotiator" as an option, and `createDirectorWithAgency()` runs for both roles, creating a new agency. A negotiator who self-registers is effectively an account owner with no team management capability — they cannot add colleagues or see a Team section. This is likely an unintended state.

2. **Removed users are not deactivated.** Setting `role: "viewer"` does not prevent login. A removed negotiator can log in, read all data their role permits (read-only), and see their old files (if they are the `agentUserId`). They just cannot mutate anything. No UX communicates this state to the removed user.

3. **Directors cannot be removed at all via the current UI.** The DELETE endpoint only accepts negotiator targets. No API route changes a director's role. To remove a director from an agency, only an internal admin action could do so.

4. **`canViewAllFiles` gives full agency-wide read access — identical to director.** It is not scoped by any other dimension. A negotiator with this flag enabled is indistinguishable from a director in terms of file visibility, but still cannot access Settings → Team or perform any team management actions.

5. **`canViewAllFiles` takes effect immediately on next request — no sign-out.** The flag is not cached in the JWT; it is fetched fresh. The previously documented "sign out and back in" requirement does not exist in the code.

6. **No team invitation flow.** Directors create accounts by entering a name, email, and password directly. There is no invitation email, no one-time link, no pending state. The new negotiator must receive their credentials through some other channel (e.g. the director telling them).

7. **firmName field.** Both User and Agency have a `firmName` field. When `resolveAgentVisibility()` uses `firmName`, it further scopes "all files" to agents whose `firmName` matches. If users within the same agency have different `firmName` values, a director may not see all files — only those created by agents with a matching firm name. Unclear whether this is intentional or a multi-branch edge case.

8. **viewer role as soft-delete.** The `viewer` role is used for two distinct purposes: (a) the initial OAuth signup state before the agency is created, and (b) the "removed from team" state. Both produce `role: "viewer"` with different `agencyId` states. A viewer with `agencyId` set is a removed team member; a viewer with no `agencyId` is an incomplete OAuth signup. No explicit `isActive` or `deletedAt` field disambiguates these states.
