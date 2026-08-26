"use client";

// Scenario D — the file-level revise-date control.
//
// Shown at the top of a file when its exchange date has passed and the file has
// gone quiet (see isExchangeOverdueStuck in lib/services/exchange-prediction.ts).
// The same overdue state also surfaces on the hub attention list; both hubs link
// here, so this banner is the single place the revision is actually made.
//
// The hard block: the new date can't be saved until "we've spoken to both
// parties" is ticked. Enforced here and again server-side in
// reviseOverdueExchangeDateAction, so a date never slides in silence.
//
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { reviseOverdueExchangeDateAction } from "@/app/actions/transactions";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [informed, setInformed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canSave = !!date && informed && !pending;

  function close() {
    if (pending) return;
    setOpen(false);
    setDate("");
    setInformed(false);
    setError(null);
  }

  function save() {
    if (!canSave) return;
    setError(null);
    start(async () => {
      try {
        await reviseOverdueExchangeDateAction({ transactionId, newDate: date, bothPartiesInformed: informed });
        setOpen(false);
        setDate("");
        setInformed(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
      }
    });
  }

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

      <Modal
        open={open}
        onClose={close}
        ariaLabel="Revise expected exchange date"
        size="md"
        dismissOnBackdrop={false}
      >
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Give this a realistic new date
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{address}</p>
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
          <input
            id="revise-exchange-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid var(--agent-border, rgba(15,23,42,0.14))",
              marginBottom: 16,
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
    </>
  );
}
