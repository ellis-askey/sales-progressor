// /admin/audit — retired 2026-08-15. The Command Centre has the canonical
// audit log at /command/audit. This route redirects any old bookmarks.

import { redirect } from "next/navigation";

export default function AdminAuditRedirect() {
  redirect("/command/audit");
}
