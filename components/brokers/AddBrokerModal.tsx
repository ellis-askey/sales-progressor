"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { titleCase, normalizePhone } from "@/lib/utils";

type Handler = { id: string; name: string; phone: string | null; email: string | null };
type Firm = { id: string; name: string };

type Props = {
  prefillName: string;
  onClose: () => void;
  onCreated: (firm: Firm, handler: Handler | null) => void;
};

export function AddBrokerModal({ prefillName, onClose, onCreated }: Props) {
  const { theme } = usePortalTheme();
  const [firmName, setFirmName] = useState(prefillName);
  const [handlerName, setHandlerName] = useState("");
  const [handlerPhone, setHandlerPhone] = useState("");
  const [handlerEmail, setHandlerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ firm: false, name: false, phone: false, email: false });
  const inputRef = useRef<HTMLInputElement>(null);

  const firmValid = touched.firm && firmName.trim().length >= 2;
  const nameValid = touched.name && handlerName.trim().length >= 2;
  const phoneValid = touched.phone && /\d{10,}/.test(handlerPhone.replace(/\D/g, ""));
  const emailValid = touched.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handlerEmail.trim());

  function touch(field: keyof typeof touched) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function blurFirm() { touch("firm"); setFirmName((v) => titleCase(v)); }
  function blurName() { touch("name"); setHandlerName((v) => titleCase(v)); }
  function blurPhone() { touch("phone"); setHandlerPhone((v) => normalizePhone(v)); }
  function blurEmail() {
    touch("email");
    const formatted = handlerEmail.trim().toLowerCase();
    setHandlerEmail(formatted);
    if (formatted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formatted)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError(null);
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

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
    if (handlerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handlerEmail.trim())) {
      setEmailError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/broker-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: titleCase(firmName),
          handler: handlerName.trim()
            ? { name: titleCase(handlerName), phone: normalizePhone(handlerPhone), email: handlerEmail.trim().toLowerCase() || null }
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create brokerage");

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
      <div className="fixed inset-0 agent-backdrop-overlay" />

      <div
        className="rounded-2xl w-full max-w-md"
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--agent-surface-elevated)",
          border: "0.5px solid rgba(0,0,0,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Add mortgage broker</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Firm name — required */}
          <div>
            <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
              Brokerage name
              {firmValid
                ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                : touched.firm && firmName.trim().length < 2
                  ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                  : null}
            </label>
            <input
              ref={inputRef}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              onBlur={blurFirm}
              placeholder="e.g. Bright Future Mortgages"
              required
              className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
            />
          </div>

          {/* Broker contact — optional */}
          <div>
            <p className="agent-section-label mb-3">Broker contact</p>
            <div className="space-y-3">
              {/* Full name + Mobile on same row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                    Full name
                    {nameValid && <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />}
                  </label>
                  <input
                    value={handlerName}
                    onChange={(e) => setHandlerName(e.target.value)}
                    onBlur={blurName}
                    placeholder="e.g. James Morris"
                    className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                    Contact number
                    {phoneValid && <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />}
                  </label>
                  <input
                    type="tel"
                    value={handlerPhone}
                    onChange={(e) => setHandlerPhone(e.target.value)}
                    onBlur={blurPhone}
                    placeholder="07700 900 000"
                    className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
                  />
                </div>
              </div>
              {/* Email — full width */}
              <div>
                <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                  Email
                  {emailValid && <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />}
                </label>
                <input
                  type="email"
                  value={handlerEmail}
                  onChange={(e) => { setHandlerEmail(e.target.value); setEmailError(null); }}
                  onBlur={blurEmail}
                  placeholder="j.morris@broker.co.uk"
                  className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${emailError ? " agent-input-error" : ""}`}
                />
                {emailError && <p className="agent-helper-error">{emailError}</p>}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!firmName.trim() || loading}
              className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save brokerage"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
