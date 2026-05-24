"use client";

// components/billing/PricingDisclosure.tsx
//
// Renders the TermsVersion.bodySections as the disclosure (NO hardcoded copy),
// with a single "I understand, billed monthly on exchange" button that posts
// to /api/billing/acknowledge. On success the page is refreshed and the
// server component re-resolves to "card_form" state, replacing this with the
// Stripe Elements form.
//
// Sections are { heading, body } pairs from the structured TermsVersion
// column. The redesigned disclosure on the billing-hub polish page (Stage 2)
// uses the same data via the same component contract — typographic structure
// added there. For now this renders headed sections as plain text blocks.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TermsSection } from "@/lib/billing/terms-sections";

type Props = {
  termsVersionId: string;
  termsSections: TermsSection[];
  termsVersionTag: string;
};

export function PricingDisclosure({ termsVersionId, termsSections, termsVersionTag }: Props) {
  const router = useRouter();
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAcknowledge() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/acknowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ termsVersionId }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "Couldn't record acknowledgement — try again");
          return;
        }
        router.refresh();
      } catch {
        setError("Couldn't reach the server — check your connection and try again");
      }
    });
  }

  return (
    <div
      style={{
        background: "var(--agent-card-bg, white)",
        border: "1px solid var(--agent-border, #e5e7eb)",
        borderRadius: 12,
        padding: 24,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Pricing disclosure</h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-secondary, #6b7280)" }}>
          Version: <code>{termsVersionTag}</code>
        </p>
      </div>

      {/* Body — TermsVersion.bodySections rendered as headed sections.
          Each section's body is plain-text (no HTML/markdown parse) so
          there's no injection surface on the one screen with legal weight. */}
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.6,
          maxHeight: 480,
          overflowY: "auto",
          padding: 16,
          background: "var(--agent-readonly-bg, #f9fafb)",
          border: "1px solid var(--agent-border, #e5e7eb)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {termsSections.map((s, i) => (
          <div key={i}>
            <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary, #111827)" }}>
              {s.heading}
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary, #4b5563)" }}>
              {s.body}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#dc2626",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 14px",
          }}
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleAcknowledge}
        disabled={submitting}
        style={{
          padding: "12px 20px",
          background: submitting ? "#94a3b8" : "var(--agent-primary, #FF6B4A)",
          color: "white",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          alignSelf: "start",
        }}
      >
        {submitting ? "Recording…" : "I understand, billed monthly on exchange"}
      </button>
    </div>
  );
}
