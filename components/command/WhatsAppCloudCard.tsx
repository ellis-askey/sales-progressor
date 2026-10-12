"use client";

// Command Centre → WhatsApp → "Official Cloud API" card (Phase 1).
// Shows the real connection state (env + webhook intake counts) and runs the
// end-to-end proof: send a test message, then watch its genuine lifecycle
// (sent → delivered → read) arrive via status webhooks. Command Centre visual
// system (Law 9): utilitarian dark, hairline borders, blue accent, no glass.

import { useEffect, useRef, useState } from "react";
import { sendCloudTestAction, getCloudLifecycleAction } from "@/app/actions/command-whatsapp";
import type { CloudPhase1Status } from "@/lib/command/whatsapp-cloud";

const LIFECYCLE_ORDER = ["sent", "delivered", "read"] as const;

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
}

export function WhatsAppCloudCard({ status }: { status: CloudPhase1Status }) {
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wamid, setWamid] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<{ status: string; at: string }[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // After a test send, poll the status-webhook trail for 90 seconds.
  useEffect(() => {
    if (!wamid) return;
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const rows = await getCloudLifecycleAction(wamid);
        setLifecycle(rows);
        const done = rows.some((r) => r.status === "read" || r.status === "failed");
        if (done || ticks > 30) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [wamid]);

  async function sendTest() {
    setSending(true);
    setError(null);
    setWamid(null);
    setLifecycle([]);
    try {
      const res = await sendCloudTestAction(to);
      if (res.ok && res.wamid) setWamid(res.wamid);
      else setError(res.error ?? "Send failed.");
    } finally {
      setSending(false);
    }
  }

  const reached = new Set(lifecycle.map((l) => l.status));
  const failed = lifecycle.find((l) => l.status === "failed");

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">Official Cloud API <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-blue-400 border border-blue-900 rounded px-1.5 py-0.5">Phase 1</span></h2>
          <p className="mt-1 text-[12px] text-neutral-500 max-w-xl">
            The Meta-official integration that replaces the bridge over time. This card proves the pipe: send a test, watch real
            delivery statuses arrive from Meta.
          </p>
        </div>
        <span
          className={
            status.configured
              ? "text-[11px] font-semibold text-emerald-400 border border-emerald-900 bg-emerald-950/40 rounded-full px-2.5 py-1"
              : "text-[11px] font-semibold text-neutral-400 border border-neutral-700 bg-neutral-800 rounded-full px-2.5 py-1"
          }
        >
          {status.configured ? "Configured" : "Awaiting setup"}
        </span>
      </div>

      {!status.configured ? (
        <p className="mt-3 text-[12.5px] text-neutral-400">
          Not switched on yet. Needs the five env vars (<code className="text-neutral-300">WHATSAPP_CLOUD_*</code>) from the Meta app —
          the setup checklist is in <code className="text-neutral-300">docs/active/ELLIS_MANUAL_TODO.md</code>. Nothing here affects the
          existing bridge.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            <div><span className="text-neutral-500 block">Number id</span><span className="text-neutral-300">{status.phoneNumberId}</span></div>
            <div><span className="text-neutral-500 block">Last webhook event</span><span className="text-neutral-300">{fmtWhen(status.lastEventAt)}</span></div>
            <div><span className="text-neutral-500 block">Events in 24h</span><span className="text-neutral-300">{status.messages24h} msgs · {status.statuses24h} statuses</span></div>
            <div><span className="text-neutral-500 block">Awaiting Phase 2 routing</span><span className="text-neutral-300">{status.unprocessed} messages held</span></div>
          </div>

          <div className="mt-4 border-t border-neutral-800 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 mb-2">End-to-end test</p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Your mobile, e.g. +4475…"
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-blue-700 w-56"
              />
              <button
                onClick={sendTest}
                disabled={sending || to.replace(/[^0-9]/g, "").length < 10}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-lg px-4 py-2 transition-colors"
              >
                {sending ? "Sending…" : "Send test message"}
              </button>
            </div>
            {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
            {wamid && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-neutral-500">Accepted by Meta. Live statuses:</span>
                {LIFECYCLE_ORDER.map((s) => (
                  <span
                    key={s}
                    className={
                      reached.has(s)
                        ? "text-[11px] font-semibold text-emerald-400 border border-emerald-900 bg-emerald-950/40 rounded-full px-2 py-0.5"
                        : "text-[11px] text-neutral-600 border border-neutral-800 rounded-full px-2 py-0.5"
                    }
                  >
                    {s}
                  </span>
                ))}
                {failed && <span className="text-[11px] font-semibold text-red-400 border border-red-900 bg-red-950/40 rounded-full px-2 py-0.5">failed</span>}
                {!failed && !reached.has("read") && <span className="text-[11px] text-neutral-600">updating…</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
