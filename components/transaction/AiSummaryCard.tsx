"use client";

// Overview restyle 2026-07-03 — extracts the AI summary from the header
// modal into an on-page card on the Overview tab. Still ellis-only via a
// caller-side gate (same pattern as AiSummaryButton).
//
// States:
//   idle       - "Generate summary" CTA. No API call made yet.
//   loading    - spinner while the server action runs.
//   ready      - shows status summary + 2 chips (watch-outs / next date).
//   error      - inline error + retry.

import { useState, useTransition } from "react";
import { Sparkle, ShieldCheck, CalendarBlank, WarningCircle, Robot, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { generateTransactionSummaryAction, type SummaryJson } from "@/app/actions/transaction-summary";
import { GlassCard } from "@/components/glass/GlassCard";

function formatDateMaybe(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return s;
}

export function AiSummaryCard({ transactionId }: { transactionId: string }) {
  const [summary, setSummary] = useState<SummaryJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await generateTransactionSummaryAction(transactionId);
      if (res.ok) setSummary(res.summary);
      else setError(res.error);
    });
  }

  const nextDate = summary?.keyDates?.[0];
  const watchOuts = summary?.watchOutFor?.trim();
  const noRisks = watchOuts === "" || watchOuts === "None" || watchOuts === "No risks identified";

  return (
    // Design Lab: `overview-ai-summary` (Ellis-only card). Default v22.
    <GlassCard
      glassId="overview-ai-summary"
      label="Overview · AI summary"
      defaultVariant="v22"
      style={{
        position: "relative",
        padding: "16px 90px 16px 18px",
        minHeight: 96,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <MascotGlyph />
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 7,
            background: "rgba(var(--agent-coral-rgb), 0.12)",
            color: "var(--agent-coral-deep)",
          }}>
            <Sparkle size={13} weight="fill" />
          </span>
          <p className="agent-eyebrow" style={{ margin: 0 }}>AI summary</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--agent-text-secondary)",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: pending ? "default" : "pointer",
            fontFamily: "inherit",
          }}
          className={pending ? "" : "agent-link"}
        >
          {pending ? "Generating…" : summary ? "Regenerate" : "Generate summary"}
        </button>
      </div>

      {/* Body */}
      {!summary && !pending && !error && (
        <p style={{
          margin: 0,
          fontSize: 12,
          color: "var(--agent-text-muted)",
          lineHeight: 1.5,
        }}>
          Click <span style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>Generate summary</span> for a fresh read on this file. Powered by Haiku 4.5.
        </p>
      )}

      {pending && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 14, height: 14, borderRadius: "50%",
              border: "2px solid rgba(15,23,42,0.1)",
              borderTopColor: "var(--agent-coral)",
              animation: "agent-spin 700ms linear infinite",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Reading milestones + activity…</span>
        </div>
      )}

      {error && (
        <p style={{
          margin: 0,
          fontSize: 12,
          color: "var(--agent-warning)",
          lineHeight: 1.5,
        }}>{error}</p>
      )}

      {summary && (
        <>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: "var(--agent-text-primary)",
            lineHeight: 1.55,
          }}>{summary.status}</p>

          {/* Chip row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <Chip
              Icon={noRisks ? ShieldCheck : WarningCircle}
              label={noRisks ? "No risks identified" : "Watch-outs flagged"}
              tone={noRisks ? "good" : "warn"}
            />
            {nextDate && (
              <Chip
                Icon={CalendarBlank}
                label={`${nextDate.label}: ${formatDateMaybe(nextDate.date)}`}
                tone="neutral"
              />
            )}
          </div>
        </>
      )}
    </GlassCard>
  );
}

function Chip({
  Icon, label, tone,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any;
  label: string;
  tone: "good" | "warn" | "neutral";
}) {
  const cfg = tone === "good"
    ? { color: "#047857", bg: "rgba(16, 185, 129, 0.12)" }
    : tone === "warn"
      ? { color: "#b45309", bg: "rgba(245, 158, 11, 0.12)" }
      : { color: "var(--agent-text-secondary)", bg: "rgba(15,23,42,0.05)" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11,
      fontWeight: 500,
      padding: "3px 9px",
      borderRadius: 6,
      background: cfg.bg,
      color: cfg.color,
    }}>
      <Icon size={12} weight="regular" />
      {label}
    </span>
  );
}

// Small mascot in the bottom-right corner of the AI summary card. Phosphor
// Robot glyph inside a coral-tinted rounded square + a tiny ChatCircleDots
// bubble hovering above its head. Purely decorative; aria-hidden.
function MascotGlyph() {
  return (
    <div aria-hidden style={{
      position: "absolute",
      right: 12,
      bottom: 12,
      display: "flex",
      alignItems: "flex-end",
      gap: 2,
      pointerEvents: "none",
      opacity: 0.9,
    }}>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 42,
        height: 42,
        borderRadius: 10,
        background: "rgba(var(--agent-coral-rgb), 0.10)",
        border: "0.5px solid rgba(var(--agent-coral-rgb), 0.24)",
        color: "var(--agent-coral-deep)",
      }}>
        <Robot size={24} weight="duotone" />
      </div>
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        borderRadius: 999,
        marginBottom: 22,
        marginLeft: -4,
        background: "white",
        border: "0.5px solid rgba(15, 23, 42, 0.08)",
        color: "var(--agent-text-secondary)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.05)",
      }}>
        <ChatCircleDots size={12} weight="fill" />
      </div>
    </div>
  );
}
