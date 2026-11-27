"use client";

import { useEffect, useState } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { Button } from "@/components/ui/Button";

// The agency's "Request to connect" step. Mirrors the progression AddClientModal
// (coral band header + optional note + "send request" footer), reversed so the
// AGENCY is the one asking. Presentational — the caller owns what "send" does.

export function NetworkConnectModal({
  open,
  onClose,
  onSend,
  progressorName,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
  progressorName: string;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Request to connect" size="md" closeTone="onDark" zLayer="escalated" dismissOnBackdrop={false}>
      <Modal.Header style={SHEET_BAND_STYLE}>
        <SheetBandHeader
          icon={<PaperPlaneTilt size={18} weight="bold" />}
          title="Request to connect"
          subtitle={`Ask ${progressorName} to progress your sales`}
        />
      </Modal.Header>
      <Modal.Body>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 7 }}>
          Add a note <span style={{ color: "var(--agent-text-muted)", fontWeight: 500 }}>(optional)</span>
        </label>
        <textarea
          className="agent-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={`Tell ${progressorName} a bit about your agency and what you're looking for…`}
          style={{ width: "100%", resize: "vertical", padding: "10px 12px", lineHeight: 1.5 }}
        />
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          We&apos;ll send {progressorName} your request. You can hand them sales once they accept — nothing is shared until then.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={() => onSend(note)}>
          <PaperPlaneTilt size={16} weight="bold" /> Send request
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
