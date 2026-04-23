"use client";

import { useState, useRef } from "react";

type Props = {
  email: string;
  onVerified: () => void;
  onCancel: () => void;
};

export function InboxVerifyFlow({ email, onVerified, onCancel }: Props) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function submit() {
    const code = digits.join("");
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/agent/verified-emails/inbox/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Verification failed");
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } else {
      onVerified();
    }
  }

  const code = digits.join("");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-slate-900/80 mb-1">Check your inbox</p>
        <p className="text-xs text-slate-900/50">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below or click the link in the email.
        </p>
      </div>

      {/* Digit inputs */}
      <div className="flex gap-2 justify-center" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-14 text-center text-xl font-bold rounded-xl border-2 transition-colors focus:outline-none"
            style={{
              background: "rgba(255,255,255,0.7)",
              borderColor: d ? "#2563eb" : "rgba(15,23,42,0.12)",
              color: "#1a1d29",
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium text-center">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={code.length !== 6 || loading}
          className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-semibold transition-colors"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-3 rounded-xl text-sm text-slate-900/50 hover:text-slate-900/80 hover:bg-white/40 transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-slate-900/40 text-center">
        Didn&apos;t get it?{" "}
        <button
          className="text-blue-500 hover:text-blue-600 font-medium"
          onClick={async () => {
            await fetch("/api/agent/verified-emails/inbox", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
          }}
        >
          Resend code
        </button>
      </p>
    </div>
  );
}
