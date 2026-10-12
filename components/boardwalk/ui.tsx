"use client";

// Boardwalk Forms UI primitives. Deliberately NOT components/ui — those are
// agent-themed (Law 9: never mix visual systems). These are thin wrappers over
// the .bw-* classes in app/boardwalk/boardwalk.css. See components/boardwalk/
// README.md for the domain-folder rationale.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ─── Button ──────────────────────────────────────────────────────────────────

export function BwButton({
  variant = "secondary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  return (
    <button
      className={`bw-btn bw-btn-${size} bw-btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          style={{
            width: 13,
            height: 13,
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "bw-spin 0.7s linear infinite",
          }}
        />
      )}
      {children}
      <style jsx>{`
        @keyframes bw-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}

// ─── Switch ──────────────────────────────────────────────────────────────────

export function BwSwitch({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="bw-switch"
      data-on={on}
      onClick={() => onToggle(!on)}
    />
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────────

export function BwModal({
  open,
  onClose,
  title,
  width = 520,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;
  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" onClick={onClose} />
      <div className="bw-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="bw-modal-panel" style={{ maxWidth: width }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 22px 0",
            }}
          >
            <h2 className="bw-display" style={{ fontSize: 19, margin: 0 }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              style={{ width: 30, padding: 0, fontSize: 16 }}
            >
              ×
            </button>
          </div>
          <div className="bw-scroll" style={{ padding: "16px 22px 22px", overflowY: "auto" }}>
            {children}
          </div>
          {footer && (
            <div
              style={{
                padding: "14px 22px",
                borderTop: "1px solid var(--bw-line)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                background: "var(--bw-paper)",
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Dropdown menu ───────────────────────────────────────────────────────────

export function BwMenu({
  trigger,
  children,
  align = "right",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>{trigger}</div>
      {open && (
        <div
          className="bw-menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align]: 0,
            zIndex: 60,
          }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
}

const ToastContext = createContext<{ toast: (message: string, tone?: "ok" | "error") => void }>({
  toast: () => {},
});

export function useBwToast() {
  return useContext(ToastContext);
}

export function BwToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const toast = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = next.current++;
    setItems((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="bw-fade-up"
            style={{
              background: t.tone === "error" ? "var(--bw-red)" : "var(--bw-ink)",
              color: "#fff",
              fontSize: 13.5,
              fontWeight: 550,
              padding: "10px 18px",
              borderRadius: 999,
              boxShadow: "var(--bw-shadow-lg)",
              fontFamily: "var(--bw-font-sans)",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Field wrapper ───────────────────────────────────────────────────────────

export function BwField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label className="bw-label">{label}</label>
      {children}
      {hint && <p className="bw-hint" style={{ margin: "5px 0 0" }}>{hint}</p>}
    </div>
  );
}
