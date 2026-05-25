"use client";

// components/billing/polish/RedesignedDisclosure.tsx
//
// The first-time consent gate, redesigned. Section-headed typographic
// structure (one h3 + paragraph per section from the DB, not a wall of text)
// + explicit "I have read and agree" checkbox. The button enables only when
// the checkbox is ticked, and uses the canonical button-loading pattern
// (no grey-out "Recording…" state).
//
// Still hits the same /api/billing/acknowledge endpoint with the same
// server-side gate as PR 6 — only the UI shape and the checkbox are new.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TermsSection } from "@/lib/billing/terms-sections";

export type RedesignedDisclosureProps = {
  termsVersionId: string;
  termsVersionTag: string;
  termsSections: TermsSection[];
};

export function RedesignedDisclosure({ termsVersionId, termsVersionTag, termsSections }: RedesignedDisclosureProps) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
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
      className="agent-glass"
      style={{
        borderRadius: "var(--agent-radius-xl, 14px)",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          Before we add your card
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
          Version <code>{termsVersionTag}</code> — please read and confirm.
        </p>
      </div>

      {/* Section-headed body — actual typographic structure */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxHeight: 420,
          overflowY: "auto",
          padding: "16px 18px",
          background: "var(--agent-readonly-bg, rgba(0,0,0,0.025))",
          border: "1px solid var(--agent-border-subtle, rgba(0,0,0,0.06))",
          borderRadius: 10,
        }}
      >
        {termsSections.map((s, i) => (
          <section key={i}>
            <h3
              style={{
                margin: "0 0 4px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--agent-text-primary)",
              }}
            >
              {s.heading}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--agent-text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {s.body}
            </p>
          </section>
        ))}
      </div>

      {/* Checkbox — must be ticked to enable the button */}
      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          cursor: "pointer",
          padding: "10px 12px",
          borderRadius: 8,
          background: agreed ? "var(--agent-primary-tint, rgba(255,107,74,0.08))" : "transparent",
          border: agreed
            ? "1px solid var(--agent-primary, #FF6B4A)"
            : "1px solid var(--agent-border-subtle, rgba(0,0,0,0.08))",
          transition: "background 150ms, border-color 150ms",
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{
            marginTop: 2,
            width: 16,
            height: 16,
            accentColor: "var(--agent-primary, #FF6B4A)",
            cursor: "pointer",
          }}
        />
        <span style={{ fontSize: 13.5, color: "var(--agent-text-primary)", lineHeight: 1.45 }}>
          I have read and agree to these terms.
        </span>
      </label>

      {error && (
        <div
          className="agent-reveal-in"
          style={{
            fontSize: 13,
            color: "var(--agent-status-negative, #dc2626)",
            background: "var(--agent-status-negative-bg, #fef2f2)",
            border: "1px solid var(--agent-status-negative-border, #fecaca)",
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
        disabled={!agreed || submitting}
        className="agent-btn agent-btn-primary"
        data-loading={submitting ? "" : undefined}
        style={{ alignSelf: "flex-start" }}
      >
        {submitting ? "Confirming…" : "Confirm & continue"}
      </button>
    </div>
  );
}
