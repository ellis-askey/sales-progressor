"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Handler = { id: string; name: string; phone: string | null; email: string | null };
type Firm = { id: string; name: string };

type Props = {
  prefillName: string;
  onClose: () => void;
  onCreated: (firm: Firm, handler: Handler | null) => void;
};

export function AddFirmModal({ prefillName, onClose, onCreated }: Props) {
  const theme = usePortalTheme();
  const [firmName, setFirmName] = useState(prefillName);
  const [handlerName, setHandlerName] = useState("");
  const [handlerPhone, setHandlerPhone] = useState("");
  const [handlerEmail, setHandlerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firmName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/solicitor-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: firmName.trim(),
          handler: handlerName.trim()
            ? { name: handlerName.trim(), phone: handlerPhone.trim() || null, email: handlerEmail.trim() || null }
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create firm");

      const handler: Handler | null = data.handlers?.[0] ?? null;
      onCreated({ id: data.id, name: data.name }, handler);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      {/* Backdrop — does not dismiss on click; user has entered data */}
      <div className="fixed inset-0 agent-backdrop-overlay" />

      {/* Card */}
      <div
        className="glass-card-strong rounded-2xl shadow-2xl w-full max-w-md"
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "2px solid var(--agent-coral-deep)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900/90">Add solicitor firm</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 8, border: "none", background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Firm name */}
          <div>
            <label className="block text-xs font-semibold text-slate-900/65 mb-1.5">
              Firm name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Carter & Wells Solicitors"
              required
              className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* Case handler (optional) */}
          <div>
            <p className="agent-section-label mb-3">
              Case handler <span className="font-normal normal-case text-slate-900/30">(optional — can add later)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-900/65 mb-1.5">Full name</label>
                <input
                  value={handlerName}
                  onChange={(e) => setHandlerName(e.target.value)}
                  placeholder="e.g. Sarah Patel"
                  className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-900/65 mb-1.5">Mobile</label>
                  <input
                    type="tel"
                    value={handlerPhone}
                    onChange={(e) => setHandlerPhone(e.target.value)}
                    placeholder="07700 900 000"
                    className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-900/65 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={handlerEmail}
                    onChange={(e) => setHandlerEmail(e.target.value)}
                    placeholder="s.patel@firm.co.uk"
                    className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!firmName.trim() || loading}
              className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save firm"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
