"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/arc/button/button";

type Props = {
  email: string;
  onVerified: () => void;
  onCancel: () => void;
};

const coralPrimary = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;

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
        <p className="text-sm font-semibold text-gray-800 mb-1">Check your inbox</p>
        <p className="text-xs text-gray-500">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below or click the link in the email.
        </p>
      </div>

      {/* Digit inputs: bespoke shape kept; the active highlight is brand coral, not blue */}
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
              background: "#ffffff",
              borderColor: d ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.12)",
              color: "var(--agent-text-primary, #1a1d29)",
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-xs text-[color:var(--agent-danger,#C73E3E)] font-medium text-center">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          style={coralPrimary}
          onClick={submit}
          disabled={code.length !== 6}
          loading={loading}
          className="flex-1"
        >
          Verify
        </Button>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Didn&apos;t get it?{" "}
        <button
          className="font-medium text-[color:var(--agent-coral-deep,#E2452A)] hover:text-[color:var(--agent-coral,#FF6B4A)]"
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
