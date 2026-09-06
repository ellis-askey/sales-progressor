// Exchange-day readiness notification.
//
// Shown in the file hero banner stack while exchange day is ACTIVE but both
// sides' solicitors haven't confirmed they're ready to exchange (VM18 seller +
// PM25 buyer). Exchange day intentionally never blocks — it can spring on you —
// so this is a soft, self-clearing heads-up rather than a gate: the moment both
// ready-codes land, the parent stops rendering it.
//
// Deliberately glossier than the flat AgentBanner (founder ask). The elevated
// chrome lives in .agent-xd-ready-* (app/agent/styles/agent-system.css) so it
// stays theme-correct in light and dark. Copy grades to whichever side is
// outstanding. See docs/active/exchange-day-SPEC.md (Decision A — gated).

import { Handshake } from "@phosphor-icons/react/dist/ssr";

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
    title = "Exchange day started before either solicitor confirmed ready";
    body =
      "We haven't logged the seller's or the buyer's solicitor confirming they're ready to exchange. This note clears once both have.";
  } else if (!sellerReady) {
    title = "The seller's solicitor hasn't confirmed ready to exchange";
    body =
      "The buyer's side is confirmed ready. This note clears once the seller's solicitor confirms too.";
  } else {
    title = "The buyer's solicitor hasn't confirmed ready to exchange";
    body =
      "The seller's side is confirmed ready. This note clears once the buyer's solicitor confirms too.";
  }

  return (
    <div className="agent-xd-ready-banner agent-reveal-in" role="status">
      <span className="agent-xd-ready-icon" aria-hidden>
        <Handshake size={17} weight="fill" />
      </span>
      <div className="agent-xd-ready-text">
        <p className="agent-xd-ready-title">{title}</p>
        <p className="agent-xd-ready-body">{body}</p>
      </div>
    </div>
  );
}
