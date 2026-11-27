"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { Modal } from "@/components/ui/Modal";
import { AgencyMeshMark } from "@/components/progression/AgencyMeshMark";
import { Button } from "@/components/ui/Button";

// The agency's "Request a connection" step. Restrained header (no coral band),
// both business identities shown with a subtle connector, accurate privacy copy,
// a generous optional-introduction field, one coral primary action.

export function NetworkConnectModal({
  open,
  onClose,
  onSend,
  agencyName,
  progressorName,
  sending = false,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (note: string) => void;
  agencyName: string;
  progressorName: string;
  sending?: boolean;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Request a connection" size="md" dismissOnBackdrop={false}>
      <Modal.Header>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--agent-text-primary)" }}>Request a connection</h2>
      </Modal.Header>
      <Modal.Body>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, padding: "4px 0 20px" }}>
          <Party name={agencyName} caption="Your agency" />
          <span aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: "rgba(var(--agent-coral-rgb),0.12)", color: "var(--agent-coral-deep)" }}>
            <ArrowRight size={15} weight="bold" />
          </span>
          <Party name={progressorName} caption="Progression partner" />
        </div>

        <p style={{ margin: "0 0 18px", textAlign: "center", fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          Establish a direct working relationship with {progressorName}. Once connected, you can assign sales to their team one at a time.
        </p>

        <div style={{ height: 1, background: "var(--agent-border-subtle)", margin: "0 0 18px" }} />

        <label htmlFor="cf-intro" style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginBottom: 8 }}>
          Introduce your agency <span style={{ color: "var(--agent-text-muted)", fontWeight: 500 }}>(optional)</span>
        </label>
        <textarea
          id="cf-intro"
          className="agent-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={`Tell ${progressorName} a little about your agency and what you're looking for…`}
          style={{ width: "100%", minHeight: 108, resize: "vertical", padding: "11px 13px", lineHeight: 1.5 }}
        />

        <p style={{ margin: "14px 0 0", display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
          <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          Connecting on its own shares no sales or client information. You choose what to assign, and when.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="md" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button variant="primary" size="md" onClick={() => onSend(note)} loading={sending}>
          Send connection request
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function Party({ name, caption }: { name: string; caption: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 0, maxWidth: 150 }}>
      <span aria-hidden style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", display: "inline-flex" }}>
        <AgencyMeshMark name={name} size={52} />
      </span>
      <p style={{ margin: "9px 0 0", fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
      <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{caption}</p>
    </div>
  );
}
