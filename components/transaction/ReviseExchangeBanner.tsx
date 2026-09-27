"use client";

// Scenario D — the file-level revise-date control.
//
// Shown at the top of a file when its exchange date has passed and the file has
// gone quiet (see isExchangeOverdueStuck in lib/services/exchange-prediction.ts).
// The same overdue state also surfaces on the hub's "Exchange dates passed"
// card, which opens the SAME modal in place — the modal itself lives in
// ReviseExchangeDateModal.tsx (extracted 2026-09-18) so there is one revise
// flow, one set of copy, one "spoken to both parties" gate.
//
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { AgentBanner } from "@/components/ui/AgentBanner";
import { ReviseExchangeDateModal } from "@/components/transaction/ReviseExchangeDateModal";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function ReviseExchangeBanner({
  transactionId,
  address,
  passedDateIso,
}: {
  transactionId: string;
  address: string;
  passedDateIso: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AgentBanner
        kind="warning"
        icon={<WarningCircle size={19} weight="fill" />}
        title="The exchange date passed and this file has gone quiet"
        body={`Expected ${formatDate(passedDateIso)}. Give it a realistic new date.`}
        action={{ label: "Set a new date →", onClick: () => setOpen(true) }}
        actionPlacement="inline-responsive"
        className="mb-4"
      />

      {open && (
        <ReviseExchangeDateModal
          transactionId={transactionId}
          address={address}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            // Phase 4 (2026-09-18, PERF-03): no client refresh - the action
            // revalidates the file page AND /agent/hub.
          }}
        />
      )}
    </>
  );
}
