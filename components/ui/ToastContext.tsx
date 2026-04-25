"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastType = "success" | "info" | "error";

export type Toast = {
  id: number;
  message: string;
  type: ToastType;
  subtext?: string;
};

type ToastContextValue = {
  addToast: (message: string, type?: ToastType, subtext?: string) => void;
};

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = "success", subtext?: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type, subtext }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </ToastContext.Provider>
  );
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const ICON_COLORS = {
  success: { bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.28)", glow: "rgba(16,185,129,0.15)", text: "#10b981" },
  info:    { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.25)",  glow: "rgba(59,130,246,0.12)",  text: "#3b82f6" },
  error:   { bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.25)",   glow: "rgba(239,68,68,0.12)",   text: "#ef4444" },
};

function ToastIcon({ type }: { type: ToastType }) {
  const c = ICON_COLORS[type];
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      boxShadow: `0 0 12px ${c.glow}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {type === "success" && (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
          <path d="M4.5 12.75l6 6 9-13.5" stroke={c.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === "info" && (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c.text} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5v-5m0-3.75h.008v.008H12V8.25zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {type === "error" && (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={c.text} strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-auto"
      style={{
        transition: "all 0.35s cubic-bezier(0.34,1.2,0.64,1)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
      }}
    >
      <div
        onClick={() => onDismiss(toast.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 18px 13px 14px",
          borderRadius: 18,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(48px) saturate(220%)",
          WebkitBackdropFilter: "blur(48px) saturate(220%)",
          border: "0.5px solid rgba(255,255,255,0.90)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.11), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.96)",
          minWidth: 320,
          maxWidth: 420,
          cursor: "pointer",
        }}
      >
        <ToastIcon type={toast.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#1C1917", lineHeight: 1.35 }}>
            {toast.message}
          </p>
          {toast.subtext && (
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(28,25,23,0.50)", lineHeight: 1.3 }}>
              {toast.subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
