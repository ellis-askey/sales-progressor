// Server wrapper for the client exchange-day card. Fetches the derived state
// for this contact (by token) and renders the card only while the file is
// actively in exchange day. Returns null otherwise. No gating needed: a file
// only enters exchange day via the agent control (founder-gated during the
// build), so only those files' clients ever see this. See docs/active/exchange-day-SPEC.md.

import { getContactExchangeDayState } from "@/lib/services/exchange-day";
import { PortalExchangeDayCard } from "./PortalExchangeDayCard";

export async function PortalExchangeDaySection({ token }: { token: string }) {
  const state = await getContactExchangeDayState(token).catch(() => null);
  if (!state || !state.active) return null;
  return <PortalExchangeDayCard token={token} saleWord={state.saleWord} authorityState={state.authorityState} />;
}
