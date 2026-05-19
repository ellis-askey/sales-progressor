"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type FeedbackType = "bug" | "idea" | "general";

const TYPE_OPTIONS: { value: FeedbackType; label: string; sub: string }[] = [
  { value: "bug",     label: "Bug report",    sub: "Something isn't working" },
  { value: "idea",    label: "Feature idea",  sub: "Suggest an improvement" },
  { value: "general", label: "General",       sub: "Anything else" },
];

export function FeedbackButton() {
  const { theme } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setDone(false);
      setMessage("");
      setType("general");
      setTimeout(() => textareaRef.current?.focus(), 80);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message }),
      });
      setDone(true);
      setTimeout(() => setOpen(false), 1800);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-2xl flex items-center justify-center glass-card transition-all hover:shadow-lg"
        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.10)" }}
        title="Send feedback"
        aria-label="Send feedback"
      >
        <svg className="w-5 h-5 text-slate-900/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </button>

      {/* Modal — portalled to body */}
      {open && createPortal(
        <div
          data-theme={theme}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          {/* Backdrop — click to dismiss */}
          <div className="fixed inset-0 agent-backdrop-overlay" onClick={() => setOpen(false)} />

          {/* Card */}
          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "var(--agent-surface-elevated)",
              border: "0.5px solid rgba(0,0,0,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
            }}
          >
            {done ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-900/80">Thanks for your feedback</p>
                <p className="text-sm text-slate-900/40 mt-1">We'll review it shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="px-6 pt-5 pb-4 border-b border-white/20 flex items-center justify-between">
                  <p className="text-base font-semibold text-slate-900/85">Send feedback</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="agent-icon-btn agent-icon-btn-md"
                  >
                    <X size={16} weight="bold" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                  {/* Type selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                          type === opt.value
                            ? "border-2 agent-badge-brand"
                            : "border-transparent bg-slate-50 agent-hover-row"
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900/70">{opt.label}</p>
                        <p className="text-[10px] text-slate-900/40 mt-0.5">{opt.sub}</p>
                      </button>
                    ))}
                  </div>

                  {/* Message */}
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what happened or what you'd like to see…"
                    rows={4}
                    className="glass-input agent-focus w-full resize-none text-sm"
                    required
                  />

                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="w-full py-2.5 rounded-xl agent-btn-color-primary text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
