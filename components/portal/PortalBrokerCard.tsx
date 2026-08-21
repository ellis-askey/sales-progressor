"use client";

// Mortgage broker card (2026-08-21). Shown to mortgage buyers only. Prompts a
// call-back from the broker resolved for the file (the agent's own broker, or
// the TSP default on outsourced files — see lib/services/broker-card.ts). The
// buyer taps, a sheet opens with their details pre-filled, and one tap sends
// the request. The card then acknowledges and stops prompting (per file, so a
// joint co-buyer sees the same). Dismiss (X) hides it via the existing
// overview-layout mechanism.

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { P, PORTAL_BTN } from "@/components/portal/portal-ui";
import { requestBrokerCallbackAction } from "@/app/actions/broker-callback";
import { portalSaveOverviewLayout } from "@/app/actions/portal";

export type PortalBrokerCardProps = {
  token: string;
  source: "agent" | "tsp";
  firmName: string;
  requested: boolean;
  prefill: { name: string; email: string | null; phone: string | null; contactMethodLabel: string };
  // Current overview layout so the dismiss X can append this card's key.
  cardKey: string;
  order: string[];
  hidden: string[];
};

export function PortalBrokerCard({
  token,
  source,
  firmName,
  requested: initialRequested,
  prefill,
  cardKey,
  order,
  hidden,
}: PortalBrokerCardProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(initialRequested);
  const [dismissed, setDismissed] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 3200);
    return () => clearTimeout(t);
  }, [showToast]);

  if (dismissed) return null;

  const subtitle =
    source === "agent"
      ? `${firmName}, recommended by your agent. A free, no obligation chat about your mortgage.`
      : "Free, no obligation mortgage advice. We'll connect you with a trusted broker.";

  function submit() {
    startTransition(async () => {
      const r = await requestBrokerCallbackAction(token);
      if (r.ok) {
        setRequested(true);
        setOpen(false);
        setShowToast(true);
      }
    });
  }

  function dismiss() {
    setDismissed(true);
    portalSaveOverviewLayout({ token, order, hidden: [...hidden, cardKey] }).catch(() => setDismissed(false));
  }

  // ── Acknowledgment state ──────────────────────────────────────────────
  if (requested) {
    return (
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: P.cardBg,
          border: `0.5px solid ${P.border}`,
          boxShadow: P.shadowSm,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: P.successBg,
            color: P.success,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 800, color: P.textPrimary }}>Request sent</p>
          <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>
            {firmName} will be in touch to talk through your mortgage options.
          </p>
        </div>
      </div>
    );
  }

  // ── Prompt state ──────────────────────────────────────────────────────
  const sheet = open ? (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        background: "rgba(15,23,42,0.42)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: P.pageBg,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.28)",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 999, background: P.border, margin: "0 auto 14px" }} />
        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: P.textPrimary }}>Request a call back</p>
        <p style={{ margin: "3px 0 16px", fontSize: 13, color: P.textSecondary, lineHeight: 1.45 }}>
          {firmName} will call you about your mortgage. We&rsquo;ll pass on the details below, nothing else.
        </p>

        <ReadRow label="Name" value={prefill.name || "Your name"} />
        {prefill.phone && <ReadRow label="Phone" value={prefill.phone} />}
        {prefill.email && <ReadRow label="Email" value={prefill.email} />}
        <ReadRow label="Best way to reach you" value={prefill.contactMethodLabel} />

        <p style={{ margin: "6px 2px 16px", fontSize: 12, color: P.textMuted }}>
          Prefer different details?{" "}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("portal:open-menu", { detail: { section: "settings" } }))}
            style={{ background: "none", border: "none", padding: 0, color: P.accent, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
          >
            Update them in settings
          </button>
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="pbtn pbtn-press"
          style={{
            width: "100%",
            fontSize: 15,
            fontWeight: 800,
            padding: "15px 16px",
            borderRadius: 14,
            background: PORTAL_BTN.primaryBg,
            boxShadow: PORTAL_BTN.primaryShadow,
            color: "#fff",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Sending…" : "Request a call back"}
        </button>
      </div>
    </div>
  ) : null;

  const toast = showToast ? (
    <div
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: "calc(18px + env(safe-area-inset-bottom))",
        zIndex: 2147483001,
        maxWidth: 460,
        margin: "0 auto",
        background: "#14181f",
        color: "#fff",
        borderRadius: 14,
        padding: "13px 15px",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ width: 22, height: 22, borderRadius: 999, background: P.success, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      The broker will be in touch
    </div>
  ) : null;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}
        className="pbtn pbtn-press"
        style={{
          position: "relative",
          borderRadius: 16,
          padding: 16,
          display: "flex",
          alignItems: "center",
          gap: 14,
          cursor: "pointer",
          textAlign: "left",
          background: "linear-gradient(160deg, rgba(255,107,74,0.11), rgba(255,107,74,0.035))",
          border: "0.5px solid rgba(255,107,74,0.16)",
          boxShadow: P.shadowSm,
        }}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{
            position: "absolute",
            top: 9,
            right: 10,
            width: 22,
            height: 22,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: P.textMuted,
            background: "rgba(15,23,42,0.04)",
            border: "none",
            cursor: "pointer",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 18 }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 800, color: P.textPrimary, letterSpacing: "-0.01em" }}>
            Speak to a mortgage broker
          </p>
          <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>{subtitle}</p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      {mounted && sheet ? createPortal(sheet, document.body) : null}
      {mounted && toast ? createPortal(toast, document.body) : null}
    </>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `0.5px solid ${P.border}`,
        borderRadius: 12,
        padding: "11px 13px",
        marginBottom: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: P.cardBg,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: P.textMuted }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: P.textPrimary, textAlign: "right" }}>{value}</span>
    </div>
  );
}
