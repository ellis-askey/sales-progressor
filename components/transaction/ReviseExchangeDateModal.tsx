"use client";

// The revise-exchange-date modal (Scenario D), extracted from
// ReviseExchangeBanner (2026-09-18) so the hub's "Exchange dates passed" card
// can open it in place instead of routing the agent to the property file.
// The banner still uses it — one modal, one set of copy, one gate.
//
// The hard block travels with it: the new date can't be saved until "we've
// spoken to both parties" is ticked. Enforced here and again server-side in
// reviseOverdueExchangeDateAction, so a date never slides in silence.
//
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { Button } from "@/components/ui/Button";
import { reviseOverdueExchangeDateAction } from "@/app/actions/transactions";
import { DateField } from "@/components/ui/DateField";

export function ReviseExchangeDateModal({
  transactionId,
  address,
  onClose,
  onSaved,
}: {
  transactionId: string;
  address: string;
  onClose: () => void;
  // Called after a successful save (the modal has already closed its state).
  onSaved: () => void;
}) {
  const [date, setDate] = useState("");
  const [informed, setInformed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canSave = !!date && informed && !pending;

  function close() {
    if (pending) return;
    onClose();
  }

  function save() {
    if (!canSave) return;
    setError(null);
    start(async () => {
      try {
        await reviseOverdueExchangeDateAction({ transactionId, newDate: date, bothPartiesInformed: informed });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

  return (
    <Modal
      open
      onClose={close}
      ariaLabel="Revise expected exchange date"
      size="md"
      dismissOnBackdrop={false}
      closeTone="onDark"
    >
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader kicker="Exchange" title="Give this a realistic new date" subtitle={address} />
      </Modal.Header>
      <Modal.Body>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--agent-text-secondary)" }}>
          The exchange date passed and this file has gone quiet. Set where you now expect it to exchange.
        </p>
        <label
          htmlFor="revise-exchange-date"
          style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", marginBottom: 6 }}
        >
          New expected exchange date
        </label>
        <DateField
          id="revise-exchange-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          wrapperStyle={{ marginBottom: 16 }}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            borderRadius: 8,
            border: "1px solid var(--agent-border, rgba(15,23,42,0.14))",
            background: "white",
          }}
        />
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--agent-text-primary)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={informed}
            onChange={(e) => setInformed(e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
          />
          <span>We&apos;ve spoken to both parties about the new date</span>
        </label>
        {error && (
          <p role="alert" style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-danger, #dc2626)" }}>
            {error}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {pending ? "Saving" : "Save new date"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
