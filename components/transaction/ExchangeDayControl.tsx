"use client";

// Exchange-day hero control (Phase 2). Subtle by design — we're aiming, not
// promising. Inactive: a quiet "Start exchange day" button that opens a confirm
// requiring the agreed completion date. Active: a muted "Exchange day" chip with
// a low-key "Not today" cancel. See docs/active/exchange-day-SPEC.md.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { startExchangeDayAction, cancelExchangeDayAction } from "@/app/actions/exchange-day";

function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

// Filled primary for the modal footers. Raw inline styles (not the Button
// primitive) because agent-btn fills flatten under the modal's Tailwind
// cascade — this mirrors UndoMilestoneModal's proven pattern.
function ModalPrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, padding: "10px 16px", borderRadius: 12, background: "#f97316", color: "white",
        fontWeight: 600, fontSize: 14, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "background 150ms, opacity 150ms",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "#ea580c"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#f97316"; }}
    >
      {children}
    </button>
  );
}

type SideAuthority = "given" | "waiting" | null;

export function ExchangeDayControl({
  transactionId,
  active,
  completionDate,
  authority,
}: {
  transactionId: string;
  active: boolean;
  completionDate: string | null;
  authority?: { seller: SideAuthority; buyer: SideAuthority } | null;
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
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
          <span
            className="agent-pill"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(var(--agent-coral-rgb), 0.10)",
              color: "var(--agent-coral-deep)",
              border: "0.5px solid rgba(var(--agent-coral-rgb), 0.28)",
              fontWeight: 700, letterSpacing: "0.01em",
            }}
            title="Aiming to exchange today"
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--agent-coral)", flexShrink: 0 }} />
            Exchange day
          </span>
          {authority && (authority.buyer || authority.seller) && (
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }} title="Client authority to exchange">
              {authority.buyer && (<>Buyer {authority.buyer === "given" ? "✓" : "waiting"}</>)}
              {authority.buyer && authority.seller && " · "}
              {authority.seller && (<>Seller {authority.seller === "given" ? "✓" : "waiting"}</>)}
            </span>
          )}
          <button
            onClick={() => setCancelOpen(true)}
            style={{ fontSize: 11, color: "var(--agent-text-muted)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Not today
          </button>
        </span>
      ) : (
        <button
          onClick={() => { setError(null); setDate(toDateInput(completionDate)); setStartOpen(true); }}
          className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}
        >
          Start exchange day
          <CaretRight size={12} weight="bold" />
        </button>
      )}

      {startOpen && (
        <Modal open onClose={() => { if (!loading) setStartOpen(false); }} size="md" ariaLabel="Start exchange day">
          <Modal.Header>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>Start exchange day</h3>
            <p style={{ fontSize: 13, color: "rgba(15,23,42,0.50)", marginTop: 4, marginBottom: 0 }}>
              Flag this file as aiming to exchange today
            </p>
          </Modal.Header>
          <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)", margin: 0 }}>
              We&apos;ll email both solicitors through the day (first thing, then a follow-up around lunchtime and one
              late afternoon if it hasn&apos;t exchanged), and ask the clients to give their solicitor authority and
              stay reachable.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Agreed completion date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "0.5px solid var(--agent-border-default)", fontSize: 14, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)" }}
              />
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--agent-text-muted)" }}>
                Required. You can&apos;t agree to exchange without an agreed completion date.
              </span>
            </label>
            {error && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{error}</p>}
          </Modal.Body>
          <Modal.Footer style={{ padding: "12px 24px 20px", gap: 12, justifyContent: undefined }}>
            <button onClick={() => setStartOpen(false)} disabled={loading} className="agent-btn agent-btn-ghost-bordered flex-1">Cancel</button>
            <ModalPrimaryButton onClick={doStart} disabled={loading}>{loading ? "Starting…" : "Start exchange day"}</ModalPrimaryButton>
          </Modal.Footer>
        </Modal>
      )}

      {cancelOpen && (
        <Modal open onClose={() => { if (!loading) setCancelOpen(false); }} size="sm" ariaLabel="End exchange day">
          <Modal.Header>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.85)", margin: 0 }}>End exchange day?</h3>
            <p style={{ fontSize: 13, color: "rgba(15,23,42,0.50)", marginTop: 4, marginBottom: 0 }}>
              Take this file out of exchange day
            </p>
          </Modal.Header>
          <Modal.Body>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)", margin: 0 }}>
              We&apos;ll stop any remaining solicitor emails for today and take the file out of exchange day. You can
              start it again any time.
            </p>
          </Modal.Body>
          <Modal.Footer style={{ padding: "12px 24px 20px", gap: 12, justifyContent: undefined }}>
            <button onClick={() => setCancelOpen(false)} disabled={loading} className="agent-btn agent-btn-ghost-bordered flex-1">Keep it on</button>
            <ModalPrimaryButton onClick={doCancel} disabled={loading}>{loading ? "Ending…" : "Not exchanging today"}</ModalPrimaryButton>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
}
