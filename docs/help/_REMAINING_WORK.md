# Help library — remaining work

**Status as of pause:** 13 articles complete. Roughly 17–22 articles remaining depending on coverage decisions.

---

## Articles complete

### Getting started
1. What is Sales Progressor?
2. Roles and permissions
3. Your first day

### Running your pipeline
4. Creating a sale
5. The Hub
6. All Files
7. Reminders
8. Completions
9. Analytics

### The property file
10. The property file
11. The Overview tab
12. The Milestones tab
13. Confirming exchange and completion

---

## Articles remaining

Each remaining article follows the same three-step process used for articles 1–13: discovery → spec → article. The user writes specs from CC's discovery reports.

### The property file — remaining tabs

- **Article 14 — The Reminders tab.** The reminder engine on a per-file basis. Cross-referenced from articles 4, 5, 11, 12.
- **Article 15 — The To-Do tab.** Manual tasks the team adds to a file. Cross-referenced from article 10.
- **Article 16 — The Activity tab.** The activity timeline, plus any email send/receive flows. Note: the `EmailParseWidget` is slated for removal and should not be covered.

### Communication and chasing

- **Article 17 — Sending chase emails.** The Chase Drawer, the Generate message AI flow, send mechanics, channel options. Cross-referenced as "Sending chase emails" throughout.
- **Article 18 — The chase task lifecycle.** How tasks are created from reminders, completed, skipped, cancelled. May fold into article 14 if the surface is small enough.

### The portal

- **Article 19 — What clients see in the portal.** The agent-side reference for what clients view.
- **Article 20 — Sending portal invites.** Token generation, invite emails, link regeneration.
- **Article 21 — When clients confirm milestones from the portal.** The portal-side milestone flow, the "Client confirmed" badge, the PM9 not-required portal whitelist.

### Property chain

- **Article 22 — The property chain.** Chain stub creation at file creation, agent claim flow, chain panel UI, multi-agent coordination.

### Possibly needed (flag during discovery for these)

- **Article 23 — Managing contacts on a file.** May fold into article 11 (Overview tab) rather than standalone. Decide during discovery.
- **Article 24 — Working with solicitors.** May fold into article 11. Decide during discovery.

### Settings and admin

- **Article 25 — Account settings.** Personal preferences, notification settings, password change.
- **Article 26 — Agency settings (admin only).** Team management, recommended firms, the assignment flow for outsourced files.
- **Article 27 — Roles and permissions (deep dive).** Reference for admins. Article 2 is a brief overview; this would be the thorough reference.

### Operational reference articles

- **Article 28 — Editing a sale's details.** The Edit Sale Details flow with milestone reconciliation. Cross-referenced from article 10.
- **Article 29 — Marking a file as withdrawn.** Fall-through reasons and what happens after withdrawal.
- **Article 30 — File status: active, on hold, completed, withdrawn.** Reference for what each state means operationally.

---

## Process reminders

When work resumes:

- Articles 1–13 are locked. Their voice, structure, and rhythm define the standard.
- Each new article starts with a discovery brief from the user, run by CC. Discovery → user writes spec → CC writes article.
- If a discovery surfaces a tractable product issue, the pattern is fix-then-write within the same brief — same as articles 7, 8, 9, 10, 11, 12+13.
- Live components in `<HelpSplit>` blocks where viable, with help-library adapters under `app/helpdrawertest/examples/`.
- British English, helpdesk register, no marketing voice, no emoji, no callout phrases.

## Sidebar conventions

- Section headings: sentence case
- Article titles: proper nouns (product names, named UI surfaces) capitalised; everything else sentence case
- Reading order, not alphabetical: ordered to match how a real user encounters the product

## Discoveries reference

All discovery reports live in `docs/help/_discovery/`. Read prior discoveries when picking up a new article — they often surface details that inform later articles.
