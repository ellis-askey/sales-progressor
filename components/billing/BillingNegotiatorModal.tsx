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

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BillingNegotiatorModal({ open, onClose }: Props) {
  const router = useRouter();
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
        style={{
          background: "white", borderRadius: 12, maxWidth: 480, width: "100%",
          padding: 28, boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111827" }}>
          Billing access is for directors
        </h2>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: "#4b5563" }}>
          Billing setup, invoices, and payment management are handled by your agency's
          director. If you're the right person to handle this, you can take the director
          role yourself — or invite someone else.
        </p>

        {error && (
          <div
            style={{
              marginTop: 16, fontSize: 13, color: "#dc2626",
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
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
              background: submitting ? "#f3f4f6" : "var(--agent-coral)",
              color: submitting ? "#9ca3af" : "white",
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
              background: "white", color: "#111827",
              border: "1px solid #e5e7eb", borderRadius: 8,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
              display: "block",
            }}
          >
            Invite a director
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "#6b7280", marginTop: 2 }}>
              Send them an email to join your agency as the director.
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              background: "transparent", color: "#6b7280",
              border: "none", borderRadius: 8,
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              marginTop: 4,
            }}
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
