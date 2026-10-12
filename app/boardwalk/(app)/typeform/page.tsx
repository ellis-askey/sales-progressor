// Legacy route: the Forms app moved to /boardwalk/forms when Boardwalk To Do
// joined the suite (2026-10-12). Kept as a permanent redirect so bookmarks
// and old links keep working. Public /f/* URLs were never under this path
// and are untouched.
import { redirect } from "next/navigation";

export default function LegacyTypeformIndex() {
  redirect("/boardwalk/forms");
}
