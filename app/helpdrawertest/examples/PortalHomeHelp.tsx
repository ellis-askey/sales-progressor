"use client";

import { PortalHomeView } from "@/components/portal/PortalHomeView";

export function PortalHomeHelpExample(_props: Record<string, string>) {
  return (
    <PortalHomeView
      address="12 Birchwood Lane, Guildford"
      side="purchaser"
      percent={62}
      completedCount={18}
      remainingCount={11}
      purchasePrice={385000}
      token="preview"
      milestone={{
        id: "preview-milestone",
        label: "Mortgage offer received",
        who: "you",
        code: "PM5",
        eventDateRequired: false,
      }}
      whatHappensNext="Your lender will arrange a valuation of the property as part of their assessment."
    />
  );
}
