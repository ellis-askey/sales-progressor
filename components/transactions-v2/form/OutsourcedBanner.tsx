"use client";

// The outsourced / PM "who is handling this sale" banner. Now rendered through the
// canonical AgentBanner with the coral kind (added 2026-11-20, decision 7) — the same
// neutral frosted surface as every other banner, with coral on the icon + border, so it
// reads in one family instead of re-implementing the recipe inline with a coral wash.
// Message, audience logic and behaviour are unchanged — this is a visual move only.

import { Headset } from "@/components/icons/ph";
import { AgentBanner } from "@/components/ui/AgentBanner";

export function OutsourcedBanner({ progressorName = null, hasExternalProgressor = false }: { progressorName?: string | null; hasExternalProgressor?: boolean } = {}) {
  // "Our team" only fits when the sale goes to TSP. An agency that works with an
  // external progressor is handing it to THEM, so name them (or a generic
  // fallback before one is picked in the multi-progressor case).
  const who = progressorName && progressorName.trim()
    ? progressorName.trim()
    : hasExternalProgressor ? "Your progressor" : "Our team";

  return (
    <AgentBanner
      kind="coral"
      icon={<Headset size={18} weight="fill" />}
      title={`${who} is handling this sale.`}
      body="Add at least one seller and one buyer, with a name and either a phone number or email address."
    />
  );
}
