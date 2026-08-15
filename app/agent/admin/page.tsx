// /agent/admin — retired 2026-08-15.
//
// The three cards that used to live here moved into the Command Centre:
//   - Agency fees      → /command/agencies
//   - Milestone + reminder-rule reference → /command/rules
// The "Admin" nav item now points straight at the Command Centre; this route
// stays only to redirect any old bookmarks.

import { redirect } from "next/navigation";

export default function AgentAdminRedirect() {
  redirect("/command/overview");
}
