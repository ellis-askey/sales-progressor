// Server wrapper for the exchange-day hero control. Fetches the derived state
// and hands it to the client control. Mirrors the EnquiryCourtChipSection
// pattern (server section → client chip) so the hero slot stays a plain node.
//
// FOUNDER-GATED while the feature is built out (Phases 3–5 pending: solicitor
// emails, client portal state, agent chip + chase suppression). Remove the gate
// once complete. See docs/active/exchange-day-SPEC.md.

import { requireSession } from "@/lib/session";
import { getExchangeDayState } from "@/lib/services/exchange-day";
import { ExchangeDayControl } from "./ExchangeDayControl";

export async function ExchangeDaySection({ transactionId }: { transactionId: string }) {
  const session = await requireSession();
  if (session.user.email !== "ellis@thesalesprogressor.co.uk") return null;

  const state = await getExchangeDayState(transactionId).catch(() => null);
  if (!state || state.exchanged) return null; // no exchange-day control once it's exchanged

  return (
    <ExchangeDayControl
      transactionId={transactionId}
      active={state.active}
      completionDate={state.completionDate ? state.completionDate.toISOString() : null}
    />
  );
}
