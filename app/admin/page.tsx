// /admin — retired 2026-08-15.
//
// This older internal-dashboard admin page (agent accounts + internal-user fee
// structures + read-only milestone/reminder tables) is superseded by the
// Command Centre: agency fees live on /command/agencies, the engine reference on
// /command/rules. The route stays only to redirect old bookmarks.

import { redirect } from "next/navigation";

export default function AdminRedirect() {
  redirect("/command/overview");
}
