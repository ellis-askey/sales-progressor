"use client";

// Exchange-day hero control (Phase 2). Subtle by design — we're aiming, not
// promising. Inactive: a quiet "Start exchange day" button that opens a confirm
// requiring the agreed completion date. Active: a muted "Exchange day" chip with
// a low-key "Not today" cancel. See docs/active/exchange-day-SPEC.md.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { startExchangeDayAction, cancelExchangeDayAction } from "@/app/actions/exchange-day";

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
  background: "var(--agent-primary)", color: "#fff", border: "none",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: "transparent", color: "var(--agent-text-secondary)", border: "0.5px solid var(--agent-border-default)",
};

export function ExchangeDayControl({
  transactionId,
  active,
  completionDate,
}: {
  transactionId: string;
  active: boolean;
  completionDate: string | null;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const pathname = usePathname();
  const [startOpen, setStartOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [date, setDate] = useState(toDateInput(completionDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doStart() {
    if (!date) { setError("Please set the agreed completion date."); return; }
    setLoading(true); setError(null);
    const r = await startExchangeDayAction({ transactionId, completionDate: date, pathname });
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    setStartOpen(false);
    toast.success("Exchange day started");
    router.refresh();
  }

  async function doCancel() {
    setLoading(true);
    const r = await cancelExchangeDayAction({ transactionId, pathname });
    setLoading(false);
    setCancelOpen(false);
    if (r.ok) { toast.success("Exchange day ended"); router.refresh(); }
  }

  return (
    <>
      {active ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span
            className="agent-pill"
            style={{ background: "rgba(100,116,139,0.14)", color: "var(--agent-text-secondary)", fontWeight: 700, letterSpacing: "0.01em" }}
            title="Aiming to exchange today"
          >
            Exchange day
          </span>
          <button
            onClick={() => setCancelOpen(true)}
            style={{ fontSize: 11, color: "var(--agent-text-muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer" }}
          >
            Not today
          </button>
        </span>
      ) : (
        <button
          onClick={() => { setError(null); setDate(toDateInput(completionDate)); setStartOpen(true); }}
          className="agent-pill"
          style={{ background: "transparent", color: "var(--agent-text-secondary)", border: "0.5px solid var(--agent-border-default)", fontWeight: 600, cursor: "pointer" }}
        >
          Start exchange day →
        </button>
      )}

      {startOpen && (
        <Modal open onClose={() => { if (!loading) setStartOpen(false); }} size="md" ariaLabel="Start exchange day">
          <Modal.Header>Start exchange day</Modal.Header>
          <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)", margin: 0 }}>
              You&apos;re flagging this file as aiming to exchange today. We&apos;ll email both solicitors through the
              day (first thing, then a follow-up around lunchtime and one late afternoon if it hasn&apos;t exchanged),
              and ask the clients to give their solicitor authority and stay reachable.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Agreed completion date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-default)", fontSize: 14, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)" }}
              />
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--agent-text-muted)" }}>
                Required — you can&apos;t agree to exchange without an agreed completion date.
              </span>
            </label>
            {error && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{error}</p>}
          </Modal.Body>
          <Modal.Footer style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setStartOpen(false)} disabled={loading} style={btnGhost}>Cancel</button>
            <button onClick={doStart} disabled={loading} style={btnPrimary}>{loading ? "Starting…" : "Start exchange day"}</button>
          </Modal.Footer>
        </Modal>
      )}

      {cancelOpen && (
        <Modal open onClose={() => { if (!loading) setCancelOpen(false); }} size="sm" ariaLabel="End exchange day">
          <Modal.Header>End exchange day?</Modal.Header>
          <Modal.Body>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)", margin: 0 }}>
              We&apos;ll stop any remaining solicitor emails for today and take the file out of exchange day. You can
              start it again any time.
            </p>
          </Modal.Body>
          <Modal.Footer style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => setCancelOpen(false)} disabled={loading} style={btnGhost}>Keep it on</button>
            <button onClick={doCancel} disabled={loading} style={{ ...btnPrimary, background: "var(--agent-danger)" }}>{loading ? "Ending…" : "Not exchanging today"}</button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
