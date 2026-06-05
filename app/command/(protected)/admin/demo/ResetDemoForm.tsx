"use client";

import { useState, useTransition } from "react";
import { resetDemoAction, type ResetDemoResult } from "@/app/actions/demo-reset";

export function ResetDemoForm({ safetyOk }: { safetyOk: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ResetDemoResult | null>(null);

  const canSubmit = safetyOk && confirm === "RESET" && !pending;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      const r = await resetDemoAction(confirm);
      setResult(r);
      if (r.ok) setConfirm("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="reset-confirm" className="text-[12px] text-[#a3a3a3] flex-shrink-0">
          Type <code className="px-1.5 py-0.5 bg-[#1a1a1a] border border-[#262626] rounded text-[#fafafa] font-mono">RESET</code> to confirm:
        </label>
        <input
          id="reset-confirm"
          type="text"
          autoComplete="off"
          value={confirm}
          disabled={!safetyOk || pending}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) submit();
          }}
          className="flex-1 max-w-[200px] bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] font-mono focus:outline-none focus:border-[#2563eb] disabled:opacity-40"
          placeholder="RESET"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30 text-white"
          style={{ background: canSubmit ? "#dc2626" : "#404040" }}
        >
          {pending ? "Resetting…" : "Tear down + reseed"}
        </button>
      </div>

      {result && !result.ok && (
        <div className="px-3 py-2.5 rounded-md border border-[#7f1d1d] bg-[#2a1010] text-[12px] text-[#fca5a5] whitespace-pre-wrap font-mono">
          {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="px-3 py-2.5 rounded-md border border-[#14532d] bg-[#0c2418] text-[12px] text-[#a7f3d0] space-y-2">
          <p className="font-semibold text-[#bbf7d0]">
            Reset complete — {result.agencyName} ({result.fixtureCount} fixtures).
          </p>
          <div className="font-mono text-[#86efac]">
            <p>Director:   {result.logins.director.email}   / {result.logins.director.password}</p>
            <p>Negotiator: {result.logins.negotiator.email} / {result.logins.negotiator.password}</p>
          </div>
        </div>
      )}
    </div>
  );
}
