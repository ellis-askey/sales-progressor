"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle, Info, Warning, WarningCircle, X } from "@phosphor-icons/react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AgentToastType = "success" | "info" | "warning" | "error";

export type AgentToastOptions = {
  description?: string;
  /** ms — 0 or Infinity = persistent until dismissed */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Provide an id to replace an existing toast instead of stacking */
  id?: string;
};

type ToastItem = {
  id: string;
  type: AgentToastType;
  message: string;
  description?: string;
  duration: number;
  action?: { label: string; onClick: () => void };
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DURATIONS: Record<AgentToastType, number> = {
  success: 4000,
  info:    4000,
  warning: 6000,
  error:   8000,
};

// ─── Context ──────────────────────────────────────────────────────────────────

type ContextValue = {
  push: (type: AgentToastType, message: string, options?: AgentToastOptions) => void;
  dismiss: (id: string) => void;
};

const Ctx = createContext<ContextValue>({ push: () => {}, dismiss: () => {} });

export function useAgentToast() {
  const { push } = useContext(Ctx);
  return {
    toast: {
      success: (msg: string, opts?: AgentToastOptions) => push("success", msg, opts),
      info:    (msg: string, opts?: AgentToastOptions) => push("info",    msg, opts),
      warning: (msg: string, opts?: AgentToastOptions) => push("warning", msg, opts),
      error:   (msg: string, opts?: AgentToastOptions) => push("error",   msg, opts),
    },
  };
}

// ─── Icon config ──────────────────────────────────────────────────────────────

const ICONS: Record<AgentToastType, { Component: React.ElementType; color: string; bg: string }> = {
  success: { Component: CheckCircle,   color: "var(--agent-success)", bg: "rgba(31,138,74,0.12)"  },
  info:    { Component: Info,          color: "var(--agent-info)",    bg: "rgba(61,122,184,0.12)" },
  warning: { Component: Warning,       color: "var(--agent-warning)", bg: "rgba(201,125,26,0.12)" },
  error:   { Component: WarningCircle, color: "var(--agent-danger)",  bg: "rgba(199,62,62,0.12)"  },
};

const ACCENT: Record<AgentToastType, string> = {
  success: "var(--agent-success)",
  info:    "var(--agent-info)",
  warning: "var(--agent-warning)",
  error:   "var(--agent-danger)",
};

// ─── Individual toast item ─────────────────────────────────────────────────────

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function AgentToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingMs = useRef(item.duration);
  const startedAt   = useRef<number>(Date.now());

  const exit = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 210);
  }, [onDismiss]);

  const startTimer = useCallback((ms: number) => {
    if (!ms || ms >= 1e9) return;
    startedAt.current = Date.now();
    timerRef.current  = setTimeout(exit, ms);
  }, [exit]);

  const pauseTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current  = null;
    remainingMs.current = Math.max(0, remainingMs.current - (Date.now() - startedAt.current));
  }, []);

  const resumeTimer = useCallback(() => {
    startTimer(remainingMs.current);
  }, [startTimer]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    startTimer(remainingMs.current);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const { Component: IconComponent, color, bg } = ICONS[item.type];
  const accentColor = ACCENT[item.type];

  const isExitClass = exiting ? "agent-toast-exit" : "";

  return (
    <div
      role={item.type === "error" || item.type === "warning" ? "alert" : "status"}
      aria-live={item.type === "error" || item.type === "warning" ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      style={{
        transition: prefersReducedMotion
          ? "opacity 200ms var(--agent-ease)"
          : "opacity 200ms cubic-bezier(0.0,0.0,0.2,1), transform 200ms cubic-bezier(0.0,0.0,0.2,1)",
        opacity:   visible && !exiting ? 1 : 0,
        transform: prefersReducedMotion || (visible && !exiting) ? "translateX(0)" : "translateX(24px)",
      }}
      className={isExitClass}
    >
      <div className={`agent-toast agent-toast-${item.type}`}>
        {/* Icon circle */}
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <IconComponent weight="fill" style={{ width: 16, height: 16, color }} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: "var(--agent-text-body-sm)",
            fontWeight: "var(--agent-weight-medium)",
            color: "var(--agent-text-primary)",
            lineHeight: 1.35,
          }}>
            {item.message}
          </p>
          {item.description && (
            <p style={{
              margin: "2px 0 0",
              fontSize: "var(--agent-text-caption)",
              color: "var(--agent-text-secondary)",
              lineHeight: "var(--agent-line-base)",
            }}>
              {item.description}
            </p>
          )}
        </div>

        {/* Action button */}
        {item.action && (
          <button
            onClick={() => { item.action!.onClick(); exit(); }}
            style={{
              padding: "4px 10px",
              fontSize: "var(--agent-text-caption)",
              fontWeight: "var(--agent-weight-medium)",
              color: accentColor,
              background: "transparent",
              border: "none",
              borderRadius: "var(--agent-radius-sm)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background var(--agent-transition-fast)",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `color-mix(in srgb, ${accentColor} 10%, transparent)`)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            {item.action.label}
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={exit}
          aria-label="Dismiss notification"
          style={{
            width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none",
            color: "var(--agent-text-muted)",
            cursor: "pointer",
            borderRadius: "var(--agent-radius-sm)",
            flexShrink: 0,
            padding: 0,
            transition: "color var(--agent-transition-fast)",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--agent-text-primary)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--agent-text-muted)")}
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Provider + Stack ─────────────────────────────────────────────────────────

const MAX_VISIBLE = 4;
let _counter = 0;

export function AgentToaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((
    type: AgentToastType,
    message: string,
    options: AgentToastOptions = {},
  ) => {
    const id = options.id ?? `at-${++_counter}`;
    const baseDuration = options.duration ?? DEFAULT_DURATIONS[type];
    // If action present, minimum 6 seconds
    const duration = options.action ? Math.max(baseDuration, 6000) : baseDuration;

    const item: ToastItem = {
      id, type, message,
      description: options.description,
      duration,
      action: options.action,
    };

    setToasts(prev => {
      // Replace by id if already present
      if (prev.some(t => t.id === id)) {
        return prev.map(t => t.id === id ? item : t);
      }
      // Cap queue at 50; newest appended
      return [...prev.slice(-49), item];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Show only the last MAX_VISIBLE toasts
  const visible = toasts.slice(-MAX_VISIBLE);

  return (
    <Ctx.Provider value={{ push, dismiss }}>
      {children}
      <div
        aria-label="Notifications"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: "var(--agent-z-toast)" as unknown as number,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {visible.map(item => (
          <div key={item.id} style={{ pointerEvents: "auto" }}>
            <AgentToastItem
              item={item}
              onDismiss={() => dismiss(item.id)}
            />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
