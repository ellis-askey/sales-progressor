"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Handler = { id: string; name: string; phone: string | null; email: string | null };
type Firm = { id: string; name: string };

type Props = {
  prefillName: string;
  onClose: () => void;
  onCreated: (firm: Firm, handler: Handler | null) => void;
};

export function AddFirmModal({ prefillName, onClose, onCreated }: Props) {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)" }}
    >
      <div
        className="glass-card-strong rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900/90">Add solicitor firm</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-900/30 hover:text-slate-900/60 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Firm name */}
          <div>
            <label className="block text-xs font-medium text-slate-900/60 mb-1.5">
              Firm name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="e.g. Carter & Wells Solicitors"
              required
              className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Case handler (optional) */}
          <div>
            <p className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-3">
              Case handler <span className="font-normal normal-case text-slate-900/30">(optional — can add later)</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Full name</label>
                <input
                  value={handlerName}
                  onChange={(e) => setHandlerName(e.target.value)}
                  placeholder="e.g. Sarah Patel"
                  className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Mobile</label>
                  <input
                    type="tel"
                    value={handlerPhone}
                    onChange={(e) => setHandlerPhone(e.target.value)}
                    placeholder="07700 900 000"
                    className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-900/60 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={handlerEmail}
                    onChange={(e) => setHandlerEmail(e.target.value)}
                    placeholder="s.patel@firm.co.uk"
                    className="w-full px-3 py-2.5 text-sm border border-white/30 rounded-lg bg-white/40 text-slate-900/80 placeholder:text-slate-900/30 focus:outline-none focus:border-blue-400"
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
              className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "Saving…" : "Save firm"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20 rounded-lg transition-colors"
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
