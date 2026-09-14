"use client";

// Command Centre → Agencies → WhatsApp controls. Two per-agency switches:
//   Capture   — the kill switch for WhatsApp message capture (on by default).
//   Auto to-dos — whether WhatsApp promises become dated tasks (off by default).
// Mirrors the WeeklyUpdateControl / AgencyChaseControl toggle pattern.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import InfoTip from "@/components/command/shared/InfoTip";
import { updateAgencyWhatsAppStreamAction, type WhatsAppStream } from "@/app/actions/agency-whatsapp";

export type WhatsAppRow = {
  id: string;
  name: string;
  whatsAppCaptureEnabled: boolean;
  whatsAppTasksEnabled: boolean;
};

const STREAMS: { key: WhatsAppStream; label: string; help: string }[] = [
  { key: "whatsAppCaptureEnabled", label: "Capture", help: "Save this agency's property-group WhatsApp messages onto the file. A kill switch: on by default, capture only starts once an agent links their WhatsApp." },
  { key: "whatsAppTasksEnabled", label: "Auto to-dos", help: "Turn promises this agency's agents make over WhatsApp (with a date) into dated to-dos on the file. Off by default." },
];

function Toggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40"
      style={{ background: on ? "#2563eb" : "#3f3f46" }}
    >
      <span className="inline-block h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(22px)" : "translateX(4px)" }} />
    </button>
  );
}

export function WhatsAppControl({ agencies }: { agencies: WhatsAppRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<WhatsAppRow[]>(agencies);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(agencyId: string, stream: WhatsAppStream) {
    const row = rows.find((r) => r.id === agencyId);
    if (!row) return;
    const next = !row[stream];
    const key = `${agencyId}:${stream}`;
    setSavingKey(key);
    setError(null);
    setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [stream]: next } : r)));
    startTransition(async () => {
      const res = await updateAgencyWhatsAppStreamAction({ agencyId, stream, value: next });
      if (!res.ok) {
        setError(res.error);
        setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [stream]: !next } : r)));
      } else {
        router.refresh();
      }
      setSavingKey((c) => (c === key ? null : c));
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          WhatsApp
          <InfoTip label="What WhatsApp controls do">
            Per-agency switches for the WhatsApp integration. Capture is the kill switch for saving an
            agency&rsquo;s property-group messages onto files; Auto to-dos turns dated WhatsApp promises into
            tasks. Capture only ever runs once an agent has linked their own WhatsApp.
          </InfoTip>
        </h2>
        {error && <span className="text-[11px] text-red-400">{error}</span>}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
                {STREAMS.map((s) => (
                  <th key={s.key} className="text-center font-semibold px-3 py-2.5 border-b border-neutral-800 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {s.label}
                      <InfoTip label={s.label}>{s.help}</InfoTip>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={STREAMS.length + 1} className="px-4 py-8 text-center text-sm text-neutral-500">
                    No agencies yet.
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-900">
                    <td className="px-4 py-3 text-[13px] text-neutral-200">{a.name}</td>
                    {STREAMS.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-center">
                        <div className="inline-flex justify-center">
                          <Toggle on={a[s.key]} disabled={savingKey === `${a.id}:${s.key}`} onClick={() => toggle(a.id, s.key)} />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
