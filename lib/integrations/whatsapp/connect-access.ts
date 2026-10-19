import "server-only";
// Who may link a WhatsApp for capture (pivot 2026-10-18): agency agents
// (director/negotiator) as before, PLUS members of external progression
// businesses — their capture scopes to their own business's files via
// resolveConnectionScope. TSP internal staff use the Command Centre pairing
// for the internal number, not this self-serve path.

import type { Session } from "next-auth";
import { resolveBusinessMember } from "@/lib/services/progression-clients";

export async function canUseWhatsAppConnect(session: Session): Promise<boolean> {
  const role = session.user.role;
  if (role === "director" || role === "negotiator") return true;
  if (role === "sales_progressor") {
    return (await resolveBusinessMember(session)) !== null;
  }
  return false;
}
