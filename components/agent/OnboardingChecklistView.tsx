"use client";

import Link from "next/link";
import { CheckCircle, Circle, CaretDown, X, ListChecks } from "@phosphor-icons/react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChecklistStep = {
  label: string;
  href: string;
  done: boolean;
};

type Props = {
  steps: ChecklistStep[];
  completedCount: number;
  totalCount: number;
  onCollapse?: () => void;
  onDismiss?: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingChecklistView({
  steps,
  completedCount,
  totalCount,
  onCollapse,
  onDismiss,
}: Props) {
  const counterBadge = (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 6px",
      borderRadius: 99,
      background: "rgba(var(--agent-coral-rgb), 0.12)",
      color: "var(--agent-coral-deep)",
    }}>
      {completedCount}/{totalCount}
    </span>
  );

  return (
    <div className="glass-card" style={{
      padding: 0,
      overflow: "hidden",
      background: "var(--agent-surface-elevated)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "0.5px solid rgba(255,255,255,0.40)",
        background: "rgba(255,255,255,0.40)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ListChecks size={16} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            Getting started
          </p>
          {counterBadge}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {onCollapse && (
            <button
              onClick={onCollapse}
              style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", display: "flex" }}
              aria-label="Collapse"
            >
              <CaretDown size={14} />
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", display: "flex" }}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Step list */}
      <div style={{ padding: "8px 0" }}>
        {steps.map((step) => (
          <Link
            key={step.label}
            href={step.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 16px",
              textDecoration: "none",
              transition: "background 120ms",
              opacity: step.done ? 0.55 : 1,
            }}
            className="hover:bg-white/40"
          >
            {step.done
              ? <CheckCircle size={18} weight="fill" style={{ color: "#10b981", flexShrink: 0 }} />
              : <Circle size={18} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
            }
            <span style={{
              fontSize: 13,
              fontWeight: step.done ? 400 : 500,
              color: step.done ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
              textDecoration: step.done ? "line-through" : "none",
            }}>
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
