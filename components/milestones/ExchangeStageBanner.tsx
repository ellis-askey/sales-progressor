"use client";

// The top-of-Steps banner for the late stages of a sale (critique #293). One
// component, three states, so the live Steps tab and the /dev/exchange-banner-states
// review page render byte-identical UI:
//   ready     — everything pre-exchange is done on both sides; push for a date
//   exchanged — VM19 + PM26 confirmed; on the run-in to completion
//   completed — VM20 + PM27 confirmed; terminal, nothing left to track
// The caller decides the stage; this owns the exact strings and icons.

import { CheckCircle, Handshake, SealCheck } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";

export type ExchangeStage = "ready" | "exchanged" | "completed";

export function ExchangeStageBanner({
  stage,
  completionDateLabel,
  className,
}: {
  stage: ExchangeStage;
  // Pre-formatted en-GB "28 October" label; null when no completion date is set.
  completionDateLabel?: string | null;
  className?: string;
}) {
  if (stage === "completed") {
    return (
      <AgentBanner
        kind="success"
        icon={<SealCheck size={18} weight="fill" />}
        title="Completed."
        body="This sale is done. Nothing left to track here."
        className={className}
      />
    );
  }
  if (stage === "exchanged") {
    return (
      <AgentBanner
        kind="success"
        icon={<Handshake size={18} weight="fill" />}
        title="Exchanged."
        body={
          completionDateLabel
            ? `Completing ${completionDateLabel}. Track completion-day actions on the Completions page.`
            : "Add the completion date to finish setting up completion."
        }
        className={className}
      />
    );
  }
  return (
    <AgentBanner
      kind="success"
      icon={<CheckCircle size={18} weight="fill" />}
      title="Ready to exchange."
      body="Everything needed for exchange is done on both sides. Time to push for a date."
      className={className}
    />
  );
}
