"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle, Circle, CaretDown, CaretUp, X, ListChecks } from "@phosphor-icons/react";


const DISMISSED_KEY = "sp_onboarding_dismissed";

type Step = {
  label: string;
  href: string;
  hrefDynamic?: (firstTxId: string | null) => string;
};

const STEPS: Step[] = [
  { label: "Add your first sale",             href: "/agent/transactions/new" },
  { label: "Add client contact details",       href: "/agent/dashboard", hrefDynamic: (id) => id ? `/agent/transactions/${id}` : "/agent/dashboard" },
  { label: "Share the portal with a client",   href: "/agent/comms" },
  { label: "Verify your email address",        href: "/agent/settings" },
  { label: "Add your phone number",            href: "/agent/settings" },
];

export function OnboardingChecklist({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [steps, setSteps] = useState<boolean[]>([false, false, false, false, false]);
  const [firstTxId, setFirstTxId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(DISMISSED_KEY)) {
      setDismissed(true);
      return;
    }
    if (window.innerWidth >= 768) setOpen(true);
    fetchProgress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchProgress() {
    try {
      const res = await fetch("/api/agent/onboarding-progress");
      if (!res.ok) return;
      const data = await res.json() as { steps: boolean[]; firstTxId: string | null };
      setSteps(data.steps);
      setFirstTxId(data.firstTxId);
      // If already done, silently dismiss — no flash, no animation
      if (data.steps.every(Boolean)) {
        localStorage.setItem(DISMISSED_KEY, "1");
        setDismissed(true);
      }
    } catch {
      // silently ignore — checklist is non-critical
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    window.dispatchEvent(new Event("sp_checklist_dismissed"));
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  const completedCount = steps.filter(Boolean).length;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 40,
      width: open ? 300 : "auto",
      transition: "width 200ms ease",
    }}>
      {open ? (
        /* Expanded */
        <div className="glass-card" style={{
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          animation: "agent-toast-in 250ms var(--agent-ease) both",
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
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 6px",
                borderRadius: 99, background: "rgba(37,99,235,0.12)", color: "#1d4ed8",
              }}>
                {completedCount}/{STEPS.length}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", display: "flex" }}
                aria-label="Collapse"
              >
                <CaretDown size={14} />
              </button>
              <button
                onClick={dismiss}
                style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", display: "flex" }}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Step list */}
          <div style={{ padding: "8px 0" }}>
            {STEPS.map((step, i) => {
              const done = steps[i] ?? false;
              const href = step.hrefDynamic ? step.hrefDynamic(firstTxId) : step.href;
              return (
                <Link
                  key={step.label}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 16px",
                    textDecoration: "none",
                    transition: "background 120ms",
                    opacity: done ? 0.55 : 1,
                  }}
                  className="hover:bg-white/40"
                >
                  {done
                    ? <CheckCircle size={18} weight="fill" style={{ color: "#10b981", flexShrink: 0 }} />
                    : <Circle size={18} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                  }
                  <span style={{
                    fontSize: 13,
                    fontWeight: done ? 400 : 500,
                    color: done ? "var(--agent-text-muted)" : "var(--agent-text-primary)",
                    textDecoration: done ? "line-through" : "none",
                  }}>
                    {step.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        /* Collapsed */
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            borderRadius: "var(--agent-radius-lg)",
            border: "0.5px solid rgba(255,255,255,0.60)",
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            cursor: "pointer",
            animation: "agent-toast-in 200ms var(--agent-ease) both",
          }}
          aria-label="Expand getting started checklist"
        >
          <ListChecks size={16} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Getting started</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "1px 6px",
            borderRadius: 99, background: "rgba(37,99,235,0.12)", color: "#1d4ed8",
          }}>
            {completedCount}/{STEPS.length}
          </span>
          <CaretUp size={12} style={{ color: "var(--agent-text-muted)" }} />
        </button>
      )}
    </div>
  );
}
