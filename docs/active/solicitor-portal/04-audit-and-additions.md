# Solicitor portal — audit + additions (living plan)

**Status:** planning. Captured 2026-08-28. Nothing built from this doc yet.
**Method:** audited the shipped `/s` portal + mapped the client portal's Progress/Updates/avatars + inventoried every client-portal feature and every unused solicitor datum.

---

## A. Current state (audit)

**Shipped & good:** shell (greeting + hamburger + Overview/Progress/Updates tabs), hero (blue image + glass card + ring), Progress Overview strip, Open Updates (confirm / date+note), Other Side states card (A2), Chain Summary (B2), MOS in the menu.

**Thin / placeholder:**
- **Progress tab** — a simple 6-stage vertical list. Underuses the client portal's far richer grouped-milestone Progress page.
- **Updates tab** — only shows the Open Updates (actionable), not a chronological feed of what's happened.

**Biggest missing pieces:** a named **point of contact**, a real **documents** surface (upload + shared), **key/target dates + calendar**, **enquiries detail**, and **avatars** on an updates feed.

---

## B. The two rebuilds you flagged

### B1. Progress tab → mirror the client (limited info)
The client Progress page = **own side** (milestones grouped into sections, your due ones confirmable) + an **other-side "view only"** panel that already renders **label + tick only, NO dates, no attribution** — which is *exactly* your A2. So mirroring is low-risk and needs no new data decision.

Solicitor version:
- **Own side:** all your side's milestones grouped (Onboarding / Contract prep / Enquiries / Ready to exchange / After exchange), each with status; your due ones confirmable (same actions as Open Updates).
- **Other side:** view-only, label + tick, no dates — reusing the client's exact pattern.
- Reuses `VENDOR_GROUPS`/`PURCHASER_GROUPS` + the `PortalMilestoneList` grouping/collapse logic.

### B2. Updates tab → chronological feed with avatars
Keep **Open Updates** (actionable) pinned at the top, then a **chronological feed** of everything, newest first, grouped Today / Yesterday / This week / etc. — reusing `getPortalTimeline` + `portalConfirmationSentence` (which already has a solicitor-firm confirmer branch and a counterparty-name-stripping branch).

**Display pictures DO filter through** (your ask): an **agent/progressor** confirm shows their photo (`User.image`); a **client** confirm shows the client's photo (`Contact.image`); a **document** shows a file icon. One gap: a **solicitor** confirm has **no photo** (`SolicitorContact` has no image field) → it shows the **firm's initials/icon** + "{firm} confirmed …".

**Decisions for the feed (need your call):**
- **E1 — other-side entries?** Own-side only (your confirmations + agent messages + documents), or also include the other side's milestone events? The client feed includes them (generic, no name/photo).
- **E2 — dates on other-side entries?** A2 says no counterparty dates, so if other-side entries are in, they'd show state only, no timestamp. *My lean: keep the feed own-side (with avatars + timestamps) and let the Other Side card + Progress mirror carry the counterparty state — cleaner, no A2 tension.*
- **E3 — solicitor photo?** Show firm initials now (no photo field), or add an optional handler photo-upload later? *Lean: firm initials now.*

---

## C. Additions (ranked, with data + sensitivity)

### High value
1. **Point-of-contact card** — the assigned progressor/agent's **name + photo + phone + email + WhatsApp + save-contact vCard**. Today only "by {agency}" appears in the hero footer. Biggest gap. *(own data; safe. Mirrors `PortalTeamCard`.)*
2. **Documents surface** — a "shared documents" list (MOS + anything `sharedWithOtherSide` + agent uploads) AND let the solicitor **upload** (draft contract pack / search results / replies to enquiries). *(SHARING DECISION: which docs shown, and upload scope — this is the "send back to us" we deferred earlier.)*
3. **Key/target dates card + add-to-calendar** — target exchange, target completion, the 12-week target countdown, and `.ics` export (the client has it; `/s` doesn't). *(own/shared facts; safe.)*
4. **Enquiries detail** — the enquiries **movement timeline**, last-movement date, **stalled/escalated** flag, and the "how long outstanding" clock. Today `SolicitorEnquiries` shows only a court-line. *(own-side; safe.)*
5. **Real property photo option in the hero** — use `transaction.photoUrl` instead of / behind the stock blue brand image. *(your call: brand blue vs real photo vs blend.)*

### Medium value
6. **"Coming up" look-ahead** — your next steps, not just currently-available ones. *(own; safe.)*
7. **Other side's solicitor firm NAME** — "Other side's solicitor: {firm}". We already fetch it and don't use it. *(SHARING: name-only, low sensitivity — confirm.)*
8. **Purchase type in the hero** (mortgage / cash / cash-from-proceeds) — relevant to a conveyancer. *(shared fact; safe.)*
9. **Exchange / completion status banner** — "Exchanged — completion on {date}" / "Completed". *(shared fact; safe.)*
10. **Notifications settings** — pause reminders (1–2 wks) + granular opt-out, and "notify me when the other side replies to enquiries", replacing the blunt per-matter Stop link. *(own; safe.)*
11. **Multi-matter switcher** — "You have N other live matters with {agency}" → a directory/switcher. This is the **"toggle between your cases"** future-login you flagged long ago, partially achievable now. *(own data; bigger build.)*
12. **Follow-up button** — "chase the other side's solicitor / chase the agent", pre-filled by whose court it's in. *(own action.)*
13. **First-visit welcome sheet** — a one-time "what this link does, it's not binding, no login" primer. *(copy.)*
14. **Feedback widget** — the existing widget already takes a `portalToken`; drop-in support channel. *(drop-in.)*
15. **Edit own details** — correct the handler's name/phone and the **secondary (assistant) CC email** we hold. *(own.)*
16. **Auto-refresh** — keep a long-lived solicitor tab current. *(technical.)*

### Nice-to-have
17. **Firm track-record card** — "your firm typically exchanges in ~11 weeks across N files with {agency}" from `getSolicitorIntel`. *(own-firm stats: safe. NEVER the other firm's.)*
18. **Accessibility settings** — text size / high-contrast / dyslexic font / dark mode (defensible for any professional; skip the coral-accent picker).
19. **Save-contact vCard** — folds into #1.

### Skip (consumer-specific, low value for a solicitor)
Costs card (buyer's personal figures), survey/broker lead-gen, explain-my-email, consumer tips, onward tracker (client-reported), PWA/push (solicitors are desktop-first), money-hide toggle, customise-overview.

---

## D. Suggested build order
1. **Updates feed + Progress mirror** (your two — biggest impact, mostly reuse).
2. **Point-of-contact card + key/target dates + calendar** (high value, own data).
3. **Documents surface** (needs the sharing decision).
4. **Enquiries detail + status banner + coming-up + purchase type + other-firm name**.
5. **Notifications settings + welcome + feedback + edit-details**.
6. **Multi-matter switcher** (the future login — bigger, later).
7. **Polish + accessibility**.

---

## E. Decisions to proceed
- **E1/E2 — Updates feed scope:** own-side only, or include the other side (no dates)? *(lean: own-side + agent/docs, with avatars + timestamps.)*
- **E3 — solicitor confirmations:** firm initials now (no photo), ok?
- **Documents:** which docs shown + upload scope (draft pack / searches / replies)?
- **Other-side firm name:** ok to show name-only?
- **Firm track-record:** own-firm-only, ok?
- **Hero image:** keep the brand blue, use the real property photo, or blend?
