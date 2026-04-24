"use client";

import { useState, useEffect, useRef } from "react";

type FeedbackType = "bug" | "idea" | "general";

const TYPE_OPTIONS: { value: FeedbackType; label: string; sub: string }[] = [
  { value: "bug",     label: "Bug report",    sub: "Something isn't working" },
  { value: "idea",    label: "Feature idea",  sub: "Suggest an improvement" },
  { value: "general", label: "General",       sub: "Anything else" },
];

export function FeedbackButton() {
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
        className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-2xl flex items-center justify-center transition-all"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(16px) saturate(1.6)",
          WebkitBackdropFilter: "blur(16px) saturate(1.6)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.10)",
        }}
        title="Send feedback"
        aria-label="Send feedback"
      >
        <svg className="w-5 h-5 text-slate-900/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.94)",
              backdropFilter: "blur(28px) saturate(1.6)",
              WebkitBackdropFilter: "blur(28px) saturate(1.6)",
              border: "1px solid rgba(255,255,255,0.6)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.22), 0 4px 12px rgba(0,0,0,0.12)",
            }}
          >
            {done ? (
              <div className="px-6 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-900/80">Thanks for your feedback!</p>
                <p className="text-sm text-slate-900/40 mt-1">We'll review it shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900/80">Send feedback</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-900/30 hover:text-slate-900/60 hover:bg-slate-100 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Type selector */}
                  <div className="grid grid-cols-3 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className={`text-left p-2.5 rounded-xl border-2 transition-all ${
                          type === opt.value
                            ? "border-blue-400 bg-blue-50/60"
                            : "border-transparent bg-slate-50 hover:bg-slate-100"
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
                    className="glass-input w-full resize-none text-sm"
                    required
                  />

                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-sm font-medium text-white transition-colors"
                  >
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
