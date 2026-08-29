"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Circle, CaretDown, CaretUp, X, ListChecks } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

const dismissedKey    = (userId: string) => `sp_onboarding_dismissed_${userId}`;
const emailSkippedKey = (userId: string) => `sp_onboarding_email_skipped_${userId}`;

// Named keys prevent off-by-one errors when steps are reordered or added
type ProgressData = {
  hasThemeSet:        boolean;
  hasSale:            boolean;
  hasContactDetails:  boolean;
  hasContactEmail:    boolean;
  hasVerifiedEmail:   boolean;
  hasPhone:           boolean;
};

const DEFAULT_PROGRESS: ProgressData = {
  hasThemeSet:        false,
  hasSale:            false,
  hasContactDetails:  false,
  hasContactEmail:    false,
  hasVerifiedEmail:   false,
  hasPhone:           false,
};

type Step = {
  label: string;
  href: string;
  hrefDynamic?: (firstTxId: string | null) => string;
  progressKey: keyof ProgressData;
};

const STEPS: Step[] = [
  { label: "Add your first sale",            href: "/agent/transactions/new", progressKey: "hasSale" },
  { label: "Add client contact details",     href: "/agent/transactions", hrefDynamic: (id) => id ? `/agent/transactions/${id}` : "/agent/transactions", progressKey: "hasContactDetails" },
  { label: "Share the portal with a client", href: "/agent/comms",            progressKey: "hasContactEmail" },
  { label: "Verify your email address",      href: "/agent/account/profile", progressKey: "hasVerifiedEmail" },
  { label: "Add your phone number",          href: "/agent/account/profile", progressKey: "hasPhone" },
  { label: "Choose your branch theme",       href: "/agent/account/profile", progressKey: "hasThemeSet" },
];

// Index at which the "Finish setup" section begins. Items before this index
// are the high-leverage "Get going" set; from here onward is account polish.
const FINISH_SETUP_START = 3;

function SectionHeader({ label }: { label: string }) {
  return (
    <p style={{
      margin: 0,
      padding: "10px 16px 4px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--agent-text-muted)",
    }}>
      {label}
    </p>
  );
}

// The onboarding checklist. Two shapes off the same state:
//   - variant="floating" (default): the bottom-right drawer that follows the
//     agent around. Hidden on the hub while there are no sales, because the hub
//     shows the inline version there instead (Option B).
//   - variant="inline": rendered in the hub's empty state (top-right). Steps
//     drive the agent to add their first sale + finish account setup. Once a
//     sale exists, the inline one steps aside and the floating one takes over.
export function OnboardingChecklist({ userId, variant = "floating" }: { userId: string; variant?: "floating" | "inline" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);
  const [progress, setProgress] = useState<ProgressData>(DEFAULT_PROGRESS);
  const [firstTxId, setFirstTxId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem(emailSkippedKey(userId))) setEmailSkipped(true);
    if (localStorage.getItem(dismissedKey(userId))) {
      setDismissed(true);
      return;
    }
    // Inline always opens; the floating one opens on desktop only.
    if (variant === "inline" || window.innerWidth >= 768) setOpen(true);
    fetchProgress();

    const interval = setInterval(fetchProgress, 15_000);

    // Instant optimistic update when another component completes a step
    const onStep = (e: Event) => {
      const patch = (e as CustomEvent<Partial<ProgressData>>).detail;
      for (const [key, val] of Object.entries(patch)) {
        if (val) analytics.track(ANALYTICS_EVENTS.ONBOARDING_STEP_COMPLETED, { step: key });
      }
      setProgress((prev) => {
        const next = { ...prev, ...patch };
        if (Object.values(next).every(Boolean)) {
          localStorage.setItem(dismissedKey(userId), "1");
          setDismissed(true);
        }
        return next;
      });
    };
    window.addEventListener("sp_onboarding_step", onStep);

    return () => {
      clearInterval(interval);
      window.removeEventListener("sp_onboarding_step", onStep);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchProgress() {
    try {
      const res = await fetch("/api/agent/onboarding-progress");
      if (!res.ok) return;
      const data = await res.json() as { progress: ProgressData; firstTxId: string | null };
      setProgress(data.progress);
      setFirstTxId(data.firstTxId);
      // If already done, silently dismiss — no flash, no animation
      if (Object.values(data.progress).every(Boolean)) {
        localStorage.setItem(dismissedKey(userId), "1");
        setDismissed(true);
      }
    } catch {
      // silently ignore — checklist is non-critical
    }
  }

  function dismiss() {
    localStorage.setItem(dismissedKey(userId), "1");
    window.dispatchEvent(new Event("sp_checklist_dismissed"));
    setDismissed(true);
  }

  function skipEmail(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    localStorage.setItem(emailSkippedKey(userId), "1");
    setEmailSkipped(true);
    // Treat as completion: if everything else is done, dismiss the checklist
    const withSkip = { ...progress, hasVerifiedEmail: true };
    if (Object.values(withSkip).every(Boolean)) {
      localStorage.setItem(dismissedKey(userId), "1");
      setDismissed(true);
    }
  }

  if (!mounted || dismissed) return null;

  const effectiveProgress: ProgressData = { ...progress, hasVerifiedEmail: progress.hasVerifiedEmail || emailSkipped };
  const completedCount = Object.values(effectiveProgress).filter(Boolean).length;
  const totalCount = STEPS.length;

  // Show skip on verify email only when it's the sole remaining step
  const allOthersComplete = STEPS
    .filter((s) => s.progressKey !== "hasVerifiedEmail")
    .every((s) => effectiveProgress[s.progressKey]);

  const counterBadge = <Pill tone="brand" size="sm" style={{ fontWeight: 700 }}>{completedCount}/{totalCount}</Pill>;

  // Step list — shared by both variants.
  const stepList = (
    <div style={{ padding: "4px 0 8px" }}>
      {STEPS.map((step, i) => {
        const done = effectiveProgress[step.progressKey];
        const href = step.hrefDynamic ? step.hrefDynamic(firstTxId) : step.href;
        const showSkip = step.progressKey === "hasVerifiedEmail" && !done && allOthersComplete;
        const header = i === 0 ? "Get going" : i === FINISH_SETUP_START ? "Finish setup" : null;
        return (
          <div key={step.label}>
            {header && <SectionHeader label={header} />}
            <Link
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
                flex: 1,
              }}>
                {step.label}
              </span>
              {showSkip && (
                <button
                  onClick={skipEmail}
                  style={{
                    fontSize: 11, fontWeight: 500,
                    color: "var(--agent-text-muted)",
                    padding: "2px 7px", borderRadius: 5,
                    border: "0.5px solid var(--agent-border-default)",
                    background: "var(--agent-surface-glass)",
                    cursor: "pointer", flexShrink: 0,
                    lineHeight: 1.6,
                  }}
                >
                  Skip
                </button>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );

  // ── Inline (hub empty state) ──────────────────────────────────────────────
  if (variant === "inline") {
    // Once a sale exists the floating drawer takes over, so the inline one bows out.
    if (effectiveProgress.hasSale) return null;
    return (
      <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden", padding: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: open ? "0.5px solid var(--agent-border-subtle)" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ListChecks size={16} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
              Getting started
            </p>
            {counterBadge}
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            style={{ padding: 4, borderRadius: 6, border: "none", background: "none", cursor: "pointer", color: "var(--agent-text-muted)", display: "flex" }}
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <CaretUp size={14} /> : <CaretDown size={14} />}
          </button>
        </div>
        {open && stepList}
      </div>
    );
  }

  // ── Floating (default) ────────────────────────────────────────────────────
  // Option B: on the hub, while there are no sales, the inline version shows
  // instead — so hide the floating one there. Everywhere else it floats.
  if (pathname === "/agent/hub" && !effectiveProgress.hasSale) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      zIndex: 50,
      width: open ? 300 : "auto",
      transition: "width 200ms ease",
    }}>
      {open ? (
        /* Expanded */
        <div className="glass-card" style={{
          padding: 0,
          overflow: "hidden",
          background: "var(--agent-surface-elevated)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
          animation: "agent-toast-in 250ms var(--agent-ease) both",
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "0.5px solid var(--agent-border-default)",
            background: "var(--agent-surface-glass)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ListChecks size={16} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                Getting started
              </p>
              {counterBadge}
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

          {stepList}
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
            border: "0.5px solid var(--agent-border-default)",
            background: "var(--agent-surface-glass)",
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
          {counterBadge}
          <CaretUp size={12} style={{ color: "var(--agent-text-muted)" }} />
        </button>
      )}
    </div>
  );
}
