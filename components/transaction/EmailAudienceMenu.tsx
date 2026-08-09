"use client";

// Per-file email audience control (solicitor-confirm feature). Replaces the
// single "client emails paused" toggle with four independent switches:
//   Seller · Buyer · Seller's solicitor · Buyer's solicitor
// Each ON = emails send, OFF = paused for that audience. Solicitor rows only
// appear when a firm is on the file. Loads its own state so no page-query
// threading is needed. Hold is handled separately (AutomationControls).

import { useEffect, useState, useTransition } from "react";
import {
  loadEmailAudience,
  setEmailAudiencePaused,
  type EmailAudience,
  type EmailAudienceState,
} from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";

type Row = { audience: EmailAudience; label: string; paused: boolean; show: boolean };

export function EmailAudienceMenu({ transactionId }: { transactionId: string }) {
  const [state, setState] = useState<EmailAudienceState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pendingAudience, setPendingAudience] = useState<EmailAudience | null>(null);
  const [, startTransition] = useTransition();
  const { toast } = useAgentToast();

  useEffect(() => {
    let live = true;
    loadEmailAudience(transactionId).then((r) => {
      if (!live) return;
      if (r.ok) setState(r.data);
      else setLoadFailed(true);
    });
    return () => {
      live = false;
    };
  }, [transactionId]);

  function toggle(audience: EmailAudience, currentlyPaused: boolean) {
    if (!state || pendingAudience) return;
    const nextPaused = !currentlyPaused;
    setPendingAudience(audience);
    startTransition(async () => {
      const result = await setEmailAudiencePaused(transactionId, audience, nextPaused);
      if (result.ok) {
        setState((s) => (s ? { ...s, [`${audience}EmailsPaused`]: nextPaused } : s));
        toast.success(nextPaused ? "Emails paused" : "Emails resumed");
      } else {
        toast.error("Couldn't update — try again");
      }
      setPendingAudience(null);
    });
  }

  const rows: Row[] = state
    ? [
        { audience: "vendor", label: "Seller", paused: state.vendorEmailsPaused, show: true },
        { audience: "purchaser", label: "Buyer", paused: state.purchaserEmailsPaused, show: true },
        {
          audience: "vendorSolicitor",
          label: state.vendorSolicitorFirmName ?? "Seller's solicitor",
          paused: state.vendorSolicitorEmailsPaused,
          show: Boolean(state.vendorSolicitorFirmName),
        },
        {
          audience: "purchaserSolicitor",
          label: state.purchaserSolicitorFirmName ?? "Buyer's solicitor",
          paused: state.purchaserSolicitorEmailsPaused,
          show: Boolean(state.purchaserSolicitorFirmName),
        },
      ]
    : [];

  return (
    <div
      className="agent-reveal-in"
      style={{
        borderTop: "0.5px solid rgba(15, 23, 42, 0.08)",
        padding: "12px 4px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Automated emails</span>
      <span style={{ fontSize: 12, color: "var(--agent-text-muted)", marginBottom: 8 }}>
        Turn confirmation emails on or off for each party on this file.
      </span>

      {loadFailed && (
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Couldn&rsquo;t load email settings.</span>
      )}

      {!state && !loadFailed && (
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Loading…</span>
      )}

      {rows.filter((r) => r.show).map((r) => {
        const on = !r.paused;
        const busy = pendingAudience === r.audience;
        return (
          <div
            key={r.audience}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 0" }}
          >
            <span style={{ fontSize: 13, color: "var(--agent-text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.label}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${on ? "Pause" : "Resume"} emails for ${r.label}`}
              onClick={() => toggle(r.audience, r.paused)}
              disabled={busy}
              className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-50"
              style={{ height: 24, width: 42, background: on ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)" }}
            >
              <span
                className="inline-block rounded-full bg-white shadow transition-transform"
                style={{ height: 18, width: 18, marginTop: 3, transform: on ? "translateX(21px)" : "translateX(3px)" }}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}
