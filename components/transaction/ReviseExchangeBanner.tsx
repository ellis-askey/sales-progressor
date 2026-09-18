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
import { Button } from "@/components/ui/Button";
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
      <div
        role="status"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: 12,
          border: "1px solid var(--agent-warning, #b45309)",
          background: "rgba(245, 158, 11, 0.10)",
        }}
      >
        <WarningCircle size={20} weight="fill" color="var(--agent-warning, #b45309)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            The exchange date passed and this file has gone quiet
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>
            Expected {formatDate(passedDateIso)}. Give it a realistic new date.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          Set a new date
        </Button>
      </div>

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
