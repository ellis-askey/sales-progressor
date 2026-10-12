# components/boardwalk

UI for **Boardwalk Forms** — the white-label form-builder platform (first tenant: Boardwalk estate agency) at `/boardwalk`, with public forms at `/f/[publicId]`.

## Why these are domain-specific, not primitives

Law 9: Boardwalk is a deliberately independent visual surface (paper cream + deep green + Fraunces/Figtree, tokens in `app/boardwalk/boardwalk.css`, scoped under `.bw-scope`). Nothing here may import from `components/ui` (agent-themed) or `components/command`, and nothing outside `/boardwalk`, `/f`, or `/api/forms` may import from here.

## Components

| File | What it is |
|---|---|
| `ui.tsx` | Boardwalk-styled thin primitives: `BwButton`, `BwModal`, `BwMenu`, `BwSwitch`, `BwField`, toast provider. Wrappers over `.bw-*` CSS classes. |
| `BoardwalkWordmark.tsx` | Typographic wordmark (no logo asset exists yet — swap-ready). |
| `LoginCard.tsx` | Sign-in + forgot-password flows. |
| `WelcomePasswordCard.tsx` | Forced password change for provisioned temp-password accounts. |
| `ResetPasswordCard.tsx` | Reset-link landing page form. |
| `AccountPanel.tsx` | Account details + change password. |
| `BoardwalkShell.tsx` | Header/nav chrome for the authed area. |
| `FormsDashboard.tsx` | Forms list, search/sort/filter, create (blank/template), rename/duplicate/archive/delete, first-run empty state. |
| `builder/BuilderApp.tsx` | Builder root: autosave, undo/redo, tabs, publish, responsive panes. |
| `builder/QuestionRail.tsx` | Left pane: dnd-kit sortable structure + add-question picker. |
| `builder/CenterPreview.tsx` | Centre pane: live themed preview (reuses runner inputs). |
| `builder/Inspector.tsx` | Right pane: question/welcome/ending settings. |
| `builder/LogicEditor.tsx` | Visual show/hide + jump-rule editor. |
| `builder/DesignPanel.tsx` | Theme presets + colour/font/layout controls. |
| `builder/ShareTab.tsx` | Publish controls, link/QR/embed, limits, notifications, hidden fields. |
| `runner/FormRunner.tsx` | The respondent experience (one-at-a-time + classic layouts). |
| `runner/QuestionInput.tsx` | Per-type answer inputs, shared by runner and builder preview. |
| `responses/ResponsesClient.tsx` | Response table, analytics strip, detail viewer, CSV export, delete. |

Server logic lives in `lib/forms/` (tenant-scoped service, logic engine, validation, auth). See the Prisma models under the "Boardwalk Forms" banner in `prisma/schema.prisma`.

## To Do (components/boardwalk/todo)

Second product in the suite — Boardwalk To Do, a Todoist-style task manager sharing the login, tenant and design system with Forms. Server logic in `lib/todo/` (tenant- and permission-scoped service, recurrence engine, NL parser); pages under `app/boardwalk/(app)/todo/`.

| File | What it is |
|---|---|
| `TodoProvider.tsx` | Client store: bootstrap data, per-view task cache, optimistic mutations with rollback + undo toasts. |
| `TodoChrome.tsx` | Sidebar/mobile-nav shell, global shortcuts (Q add, / or Ctrl+K search, g-t/i/u nav), overlay mounting. |
| `TodoSidebar.tsx` | Desktop sidebar: counts, favourites, filters, My/Shared projects, collapsible sections. |
| `TaskList.tsx` | `TaskRow` + `TaskList` + `InlineAdd` — completion, hover actions, grouping, dnd-kit reorder, NL inline add. |
| `QuickAddModal.tsx` | Global capture with live natural-language parse chips. |
| `TaskDetailPanel.tsx` | Full task editor: fields, subtasks, comments/@mentions, attachments, reminders, activity. |
| `Pickers.tsx` | Shared popovers: due date (mini calendar + NL + recurrence), priority, labels, assignee, project. |
| `ProjectModal.tsx` | Create/edit project + agency template picker; `ShareModal` for membership. |
| `SearchOverlay.tsx` | Global search (tasks/comments server-side, projects/labels client-side). |
| `BulkBar.tsx` | Floating multi-select actions: reschedule, priority, assign, move, complete. |
| `NotificationsPopover.tsx` | Notification centre + browser-notification opt-in. |
| `ProjectBrowserSheet.tsx` | Mobile bottom-sheet navigation. |
| `ViewHeader.tsx` | Shared editorial view header/shell/empty-note. |
