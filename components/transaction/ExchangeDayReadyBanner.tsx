// Exchange-day readiness notification.
//
// Shown in the file hero banner stack while exchange day is ACTIVE but both
// sides' solicitors haven't confirmed they're ready to exchange (VM18 seller +
// PM25 buyer). Exchange day intentionally never blocks — it can spring on you —
// so this is a soft, self-clearing heads-up rather than a gate: the moment both
// ready-codes land, the parent stops rendering it.
//
// Renders through the shared AgentBanner "grouped inset" material (critique #13)
// so it reads as one system with every other alert. Copy grades to whichever
// side is outstanding. See docs/active/exchange-day-SPEC.md (Decision A — gated).

import { Handshake } from "@phosphor-icons/react/dist/ssr";
import { AgentBanner } from "@/components/ui/AgentBanner";

export function ExchangeDayReadyBanner({
  sellerReady,
  buyerReady,
}: {
  sellerReady: boolean;
  buyerReady: boolean;
}) {
  // Safety: nothing outstanding → nothing to say.
  if (sellerReady && buyerReady) return null;

  let title: string;
  let body: string;
  if (!sellerReady && !buyerReady) {
    title = "Exchange day has started, but neither solicitor has confirmed they're ready.";
    body =
      "We haven't logged either solicitor as ready to exchange yet. This will clear once both have confirmed.";
  } else if (!sellerReady) {
    title = "The seller's solicitor hasn't confirmed ready to exchange.";
    body =
      "The buyer's solicitor is ready. This will clear once the seller's solicitor confirms they're ready too.";
  } else {
    title = "The buyer's solicitor hasn't confirmed ready to exchange.";
    body =
      "The seller's solicitor is ready. This will clear once the buyer's solicitor confirms they're ready too.";
  }

  return (
    <AgentBanner
      kind="warning"
      icon={<Handshake size={19} weight="fill" />}
      title={title}
      body={body}
    />
  );
}
