"use client";

// components/billing/BillingNegotiatorModal.tsx
//
// Shown when a negotiator clicks "Billing" in the UserDropdown. Explains
// that billing is director-only and offers three reasonable paths:
//   - "Make me the director" — promotes self IF the agency has no existing
//     director (server-side guard). For agencies that already have a director,
//     surfaces "ask your director" guidance instead — no silent self-promotion
//     where it would displace someone.
//   - "Invite a director" — routes to the existing settings/team page where
//     director invitations are sent.
//   - "Cancel" — close.
//
// The structural 404 on /agent/billing for negotiators stays. This modal is
// the discovery surface; the page guard is the load-bearing security boundary.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BillingNegotiatorModal({ open, onClose }: Props) {
  const router = useRouter();
  const { isNight } = usePortalTheme();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handlePromote() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/agent/promote-to-director", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't update your role. Try again.");
        setSubmitting(false);
        return;
      }
      // Hard reload so the session JWT picks up the new role and the
      // Billing link starts working as a real link.
      window.location.href = "/agent/account/billing";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-night={isNight ? "" : undefined}
        className="nv2-night"
        style={{
          background: isNight ? "#161d2e" : "white", borderRadius: 12, maxWidth: 480, width: "100%",
          overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, ...SHEET_BAND_STYLE }}>
          <SheetBandHeader kicker="Billing" title="Billing access is for directors" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, flexShrink: 0, borderRadius: 8,
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.85)", transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <div style={{ padding: 28 }}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
          Billing setup, invoices, and payment management are handled by your agency's
          director. If you're the right person to handle this, you can take the director
          role yourself, or invite someone else.
        </p>

        {error && (
          <div
            style={{
              marginTop: 16, fontSize: 13, color: "var(--agent-danger, #dc2626)",
              background: "rgba(220,38,38,0.10)", border: "1px solid rgba(220,38,38,0.30)", borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
          <button
            type="button"
            onClick={handlePromote}
            disabled={submitting}
            style={{
              padding: "12px 16px", textAlign: "left",
              background: submitting ? "var(--agent-surface-subtle)" : "var(--agent-coral)",
              color: submitting ? "var(--agent-text-muted)" : "white",
              border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Updating your role…" : "Make me the director"}
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, opacity: 0.9, marginTop: 2 }}>
              Only works if your agency doesn't already have a director.
            </span>
          </button>

          <Link
            href="/agent/account/team"
            onClick={onClose}
            style={{
              padding: "12px 16px", textAlign: "left",
              background: "var(--agent-surface-subtle)", color: "var(--agent-text-primary)",
              border: "0.5px solid var(--agent-border-strong)", borderRadius: 8,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              display: "block",
            }}
          >
            Invite a director
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--agent-text-muted)", marginTop: 2 }}>
              Send them an email to join your agency as the director.
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="agent-btn agent-btn-neutral agent-btn-sm"
            style={{ marginTop: 4 }}
          >
            Go back
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
