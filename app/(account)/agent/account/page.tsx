// app/(account)/agent/account/page.tsx
//
// Bare /agent/account/ resolves to the first role-visible tab.
// Director → Billing (their first tab). Negotiator → Profile (Billing
// is hidden from them). When Profile is the only one a negotiator sees,
// this keeps the bare URL meaningful instead of dumping them on a
// 404'd Billing page.

import { redirect } from "next/navigation";
import { resolveAgentSession } from "@/lib/agent-session";

export default async function AccountIndexPage() {
  const { role } = await resolveAgentSession();
  if (role === "director") redirect("/agent/account/billing");
  redirect("/agent/account/profile");
}
