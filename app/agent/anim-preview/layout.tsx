// Dev/QA preview page — internal staff only. Hidden from customer agencies so
// they can't reach raw-code / placeholder screens by URL.

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";

export default async function DevPreviewLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const internal = hasAdminPowers(session) || session.user.role === "sales_progressor";
  if (!internal) notFound();
  return <>{children}</>;
}
