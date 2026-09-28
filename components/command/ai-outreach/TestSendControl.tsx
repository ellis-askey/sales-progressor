"use client";

import { useState } from "react";
import { sendExperimentTestAction } from "@/app/actions/outreach";

// "Send test to me" — fires every email in this experiment (control + challenger,
// all steps) to a chosen inbox, exactly as they'll send, so you can eyeball the
// real thing before publishing. Defaults to the founder's address.
export function TestSendControl({ experimentId }: { experimentId: string }) {
  const [to, setTo] = useState("ellisaskey@googlemail.com");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    setMsg(null);
    const res = await sendExperimentTestAction(experimentId, to);
    setBusy(false);
    setMsg("ok" in res && res.ok ? { ok: true, text: `Sent ${res.sent} to ${to}` } : { ok: false, text: "error" in res ? res.error : "Failed" });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="you@example.com"
        className="text-[11px] bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1 text-neutral-300 w-52 focus:outline-none focus:border-neutral-600"
      />
      <button
        onClick={send}
        disabled={busy}
        className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600 disabled:opacity-50 transition-colors"
      >
        {busy ? "Sending…" : "Send test to me"}
      </button>
      {msg && <span className={`text-[10.5px] ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>}
    </div>
  );
}
