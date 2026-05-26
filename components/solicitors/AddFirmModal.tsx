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
  // When true, the firm name field is read-only and the modal acts as
  // "add a case handler to this existing firm". Submit hits the same
  // endpoint — POST /api/solicitor-firms find-or-creates the firm and
  // attaches the new handler.
  lockFirm?: boolean;
};

export function AddFirmModal({ prefillName, onClose, onCreated, lockFirm = false }: Props) {
  const { theme, isNight } = usePortalTheme();
  const [firmName, setFirmName] = useState(prefillName);
  const [handlerName, setHandlerName] = useState("");
  const [handlerPhone, setHandlerPhone] = useState("");
  const [handlerEmail, setHandlerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState({ firm: lockFirm, name: false, phone: false, email: false });
  const inputRef = useRef<HTMLInputElement>(null);
  const handlerInputRef = useRef<HTMLInputElement>(null);

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
      setErrors((prev) => ({ ...prev, handlerEmail: "That email address doesn't look right" }));
    } else if (formatted) {
      clearFieldError("handlerEmail");
    }
  }

  useEffect(() => {
    // When firm is locked (adding a handler to an existing firm), skip
    // focusing the firm name field — go straight to the handler name input.
    if (lockFirm) {
      handlerInputRef.current?.focus();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [lockFirm]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function clearFieldError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firmName.trim()) e.firmName = "Enter the firm name";
    if (!handlerName.trim()) e.handlerName = "Enter the case handler's name";
    if (!handlerPhone.trim()) {
      e.handlerPhone = "Enter a direct line";
    } else {
      const norm = normalizePhone(handlerPhone);
      const digits = norm.replace(/\D/g, "");
      if (digits.length < 10) e.handlerPhone = "That phone number doesn't look right";
    }
    if (!handlerEmail.trim()) {
      e.handlerEmail = "Enter an email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handlerEmail.trim())) {
      e.handlerEmail = "That email address doesn't look right";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/solicitor-firms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: titleCase(firmName),
          handler: {
            name: titleCase(handlerName),
            phone: normalizePhone(handlerPhone),
            email: handlerEmail.trim().toLowerCase(),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create firm");

      // When adding to an existing firm (lockFirm), the endpoint returns
      // [...existingHandlers, newHandler] — find the just-created one by
      // name match against the form input rather than blindly taking [0].
      // For new firms the handlers array has only the new one anyway.
      const handlers: Handler[] = Array.isArray(data.handlers) ? data.handlers : [];
      const handler: Handler | null = lockFirm
        ? handlers.find((h) => h.name.trim().toLowerCase() === titleCase(handlerName).toLowerCase()) ?? handlers[handlers.length - 1] ?? null
        : handlers[0] ?? null;
      onCreated({ id: data.id, name: data.name }, handler);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again");
      setLoading(false);
    }
  }

  return createPortal(
    <div
      data-theme={theme}
      data-night={isNight ? "" : undefined}
      className="nv2-night"
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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
          <h2 style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{lockFirm ? "Add case handler" : "Add solicitor firm"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="agent-icon-btn agent-icon-btn-md">
            <X size={16} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Firm name */}
          <div>
            <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
              Firm name
              {firmValid
                ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                : touched.firm && firmName.trim().length < 2
                  ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                  : null}
            </label>
            <input
              ref={inputRef}
              value={firmName}
              onChange={(e) => { setFirmName(e.target.value); clearFieldError("firmName"); }}
              onBlur={blurFirm}
              placeholder="e.g. Carter & Wells Solicitors"
              readOnly={lockFirm}
              className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${errors.firmName ? " agent-input-error" : ""}${lockFirm ? " !bg-white/30 !text-slate-900/60" : ""}`}
            />
            {errors.firmName && <p className="agent-helper-error">{errors.firmName}</p>}
          </div>

          {/* Case handler */}
          <div>
            <p className="agent-section-label mb-3">Case handler</p>
            <div className="space-y-3">
              {/* Full name + Direct line on same row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                    Full name
                    {nameValid
                      ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                      : touched.name && handlerName.trim().length < 2
                        ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                        : null}
                  </label>
                  <input
                    ref={handlerInputRef}
                    value={handlerName}
                    onChange={(e) => { setHandlerName(e.target.value); clearFieldError("handlerName"); }}
                    onBlur={blurName}
                    placeholder="e.g. Sarah Patel"
                    className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${errors.handlerName ? " agent-input-error" : ""}`}
                  />
                  {errors.handlerName && <p className="agent-helper-error">{errors.handlerName}</p>}
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                    Direct line
                    {phoneValid
                      ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                      : touched.phone && !phoneValid
                        ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                        : null}
                  </label>
                  <input
                    type="tel"
                    value={handlerPhone}
                    onChange={(e) => { setHandlerPhone(e.target.value); clearFieldError("handlerPhone"); }}
                    onBlur={blurPhone}
                    placeholder="020 7946 0000"
                    className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${errors.handlerPhone ? " agent-input-error" : ""}`}
                  />
                  {errors.handlerPhone && <p className="agent-helper-error">{errors.handlerPhone}</p>}
                </div>
              </div>
              {/* Email — full width */}
              <div>
                <label className="flex items-center text-xs font-semibold text-slate-900/65 mb-1.5">
                  Email
                  {emailValid
                    ? <CheckCircle size={13} weight="fill" color="#059669" style={{ marginLeft: 4, flexShrink: 0 }} />
                    : touched.email && !emailValid
                      ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-block", marginLeft: 4, flexShrink: 0 }} />
                      : null}
                </label>
                <input
                  type="text"
                  value={handlerEmail}
                  onChange={(e) => { setHandlerEmail(e.target.value); clearFieldError("handlerEmail"); }}
                  onBlur={blurEmail}
                  placeholder="s.patel@firm.co.uk"
                  className={`glass-input agent-focus w-full px-3 py-2.5 text-sm${errors.handlerEmail ? " agent-input-error" : ""}`}
                />
                {errors.handlerEmail && <p className="agent-helper-error">{errors.handlerEmail}</p>}
              </div>
            </div>
          </div>

          {error && <p className="agent-helper-error" style={{ fontSize: 12 }}>{error}</p>}

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
              disabled={!firmName.trim() || !handlerName.trim() || !handlerPhone.trim() || !handlerEmail.trim() || loading}
              className="flex-1 py-2.5 agent-btn-color-primary text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : "Save firm"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
