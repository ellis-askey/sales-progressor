"use client";

// Exchange-day hero control (Phase 2). Subtle by design — we're aiming, not
// promising. Inactive: a quiet "Start exchange day" button that opens a confirm
// requiring the agreed completion date. Active: a muted "Exchange day" chip with
// a low-key "Not today" cancel. See docs/active/exchange-day-SPEC.md.

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
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
  // Local "today" (en-CA formats as YYYY-MM-DD) for the min attribute + guard.
  const todayStr = new Date().toLocaleDateString("en-CA");

  async function doStart() {
    if (!date) { setError("Please set the agreed completion date."); return; }
    if (date < todayStr) { setError("The completion date can't be in the past."); return; }
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
        <Modal open onClose={() => { if (!loading) setStartOpen(false); }} size="md" ariaLabel="Start exchange day" closeTone="onDark">
          <Modal.Header style={SHEET_BAND_STYLE}>
            <SheetBandHeader kicker="Exchange" title="Start exchange day" subtitle="Flag this file as aiming to exchange today" />
          </Modal.Header>
          <Modal.Body style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--agent-text-secondary)", margin: 0 }}>
                Here&apos;s what we&apos;ll send today:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "First thing", text: "Both solicitors are asked to exchange." },
                  { label: "9am and 11am", text: "The buyer and seller are asked to give their solicitor authority to exchange and keep their phone nearby." },
                  { label: "Lunchtime", text: "If you haven’t exchanged, we’ll follow up with both solicitors." },
                  { label: "Late afternoon", text: "Still not exchanged? We’ll send one final follow-up." },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0, marginTop: 6 }} />
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--agent-text-secondary)" }}>
                      <strong style={{ color: "var(--agent-text-primary)" }}>{item.label}:</strong> {item.text}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)", margin: 0 }}>
                Exchange day emails are only sent on weekdays. Your usual automated chasing pauses for the day, so nobody gets unnecessary emails while you&apos;re trying to exchange.
              </p>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Agreed completion date</span>
              <input
                type="date"
                value={date}
                min={todayStr}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  padding: "13px 15px", borderRadius: 12, border: "1px solid var(--agent-border-default)",
                  fontSize: 15, fontWeight: 500, background: "var(--agent-surface-elevated)",
                  color: "var(--agent-text-primary)", colorScheme: "light", width: "100%",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--agent-text-muted)" }}>
                Required. You&apos;ll need an agreed completion date before starting exchange day.
              </span>
            </label>
            {error && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{error}</p>}
          </Modal.Body>
          <Modal.Footer style={{ padding: "12px 24px 20px", gap: 12, justifyContent: undefined }}>
            <button
              onClick={() => setStartOpen(false)}
              disabled={loading}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 12, background: "transparent",
                color: "rgba(15,23,42,0.75)", fontWeight: 600, fontSize: 14,
                border: "1px solid rgba(15,23,42,0.16)", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1, transition: "background 150ms",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = "rgba(15,23,42,0.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              Cancel
            </button>
            <ModalPrimaryButton onClick={doStart} disabled={loading}>{loading ? "Starting…" : "Start exchange day"}</ModalPrimaryButton>
          </Modal.Footer>
        </Modal>
      )}

      {cancelOpen && (
        <Modal open onClose={() => { if (!loading) setCancelOpen(false); }} size="sm" ariaLabel="End exchange day" closeTone="onDark">
          <Modal.Header style={SHEET_BAND_STYLE}>
            <SheetBandHeader kicker="Exchange" title="End exchange day?" subtitle="Take this file out of exchange day" />
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
