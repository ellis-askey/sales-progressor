// Server wrapper for the exchange-day hero control. Fetches the derived state
// (+ per-side authority when active) and hands it to the client control. Mirrors
// the EnquiryCourtChipSection pattern (server section → client chip) so the hero
// slot stays a plain node. See docs/active/exchange-day-SPEC.md.

import { getExchangeDayState, getExchangeDayAuthority } from "@/lib/services/exchange-day";
import { ExchangeDayControl } from "./ExchangeDayControl";

export async function ExchangeDaySection({ transactionId }: { transactionId: string }) {
  const state = await getExchangeDayState(transactionId).catch(() => null);
  if (!state || state.exchanged) return null; // no exchange-day control once it's exchanged

  const authority = state.active ? await getExchangeDayAuthority(transactionId).catch(() => ({ seller: null, buyer: null })) : null;

  return (
    <ExchangeDayControl
      transactionId={transactionId}
      active={state.active}
      completionDate={state.completionDate ? state.completionDate.toISOString() : null}
      authority={authority}
    />
  );
}
