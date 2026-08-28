"use client";

// Command Centre → Agencies & agents → Chase control.
//
// Per-agency on/off for the three automated chase streams. Today one global
// switch drives all of them for every agency at once; this lets each agency be
// turned on or off independently. The global SolicitorChaseSettings switch stays
// as the top-level kill switch (shown here as context). Optimistic toggles via
// updateAgencyChaseStreamAction.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAgencyChaseStreamAction, type ChaseStream } from "@/app/actions/agency-chase";
import InfoTip from "@/components/command/shared/InfoTip";

export type AgencyChaseRow = {
  id: string;
  name: string;
  solicitorChaseEnabled: boolean;
  enquiryReplyChaseEnabled: boolean;
  enquiryRaiseChaseEnabled: boolean;
};

const STREAMS: { key: ChaseStream; label: string; help: string }[] = [
  { key: "solicitorChaseEnabled", label: "Solicitor confirmations", help: "Chases solicitors to confirm a step is done" },
  { key: "enquiryReplyChaseEnabled", label: "Enquiries chase", help: "Chases whoever holds the enquiries (solicitors)" },
  { key: "enquiryRaiseChaseEnabled", label: "Enquiries raise", help: "Chases to get enquiries raised (reaches buyers, not just solicitors)" },
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
      <span
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(22px)" : "translateX(4px)" }}
      />
    </button>
  );
}

export function AgencyChaseControl({
  agencies,
  globalMasterOn,
}: {
  agencies: AgencyChaseRow[];
  globalMasterOn: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AgencyChaseRow[]>(agencies);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(agencyId: string, stream: ChaseStream) {
    const row = rows.find((r) => r.id === agencyId);
    if (!row) return;
    const next = !row[stream];
    const key = `${agencyId}:${stream}`;
    setSavingKey(key);
    setError(null);
    setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [stream]: next } : r)));
    startTransition(async () => {
      const res = await updateAgencyChaseStreamAction({ agencyId, stream, value: next });
      if (!res.ok) {
        setError(res.error);
        setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [stream]: !next } : r)));
      } else {
        router.refresh();
      }
      setSavingKey((cur) => (cur === key ? null : cur));
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Chase control</h2>
          <p className="text-[12px] text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Per-agency on/off for the three automated chase streams. Turn a stream off for an
            agency and no file of theirs is chased on it. New agencies start with everything off.
          </p>
        </div>
        <div className="text-[11px] text-right shrink-0">
          <span className="text-neutral-500">Global master</span>
          <span className={`ml-2 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${globalMasterOn ? "text-emerald-400 bg-emerald-950/50 border-emerald-900" : "text-red-400 bg-red-950/50 border-red-900"}`}>
            {globalMasterOn ? "ON" : "OFF"}
          </span>
          {!globalMasterOn && <p className="text-[10.5px] text-red-400/80 mt-1 max-w-[200px]">Master is off — nothing chases regardless of the per-agency switches below.</p>}
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
        <table className="w-full text-[13px] min-w-[560px]">
          <thead>
            <tr className="bg-neutral-950/60">
              <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Agency</th>
              {STREAMS.map((s) => (
                <th key={s.key} className="text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  <span className="inline-flex items-center gap-1 justify-center">
                    {s.label}
                    <InfoTip label={s.label} align="right">{s.help}</InfoTip>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3 text-neutral-200 whitespace-nowrap">{a.name}</td>
                {STREAMS.map((s) => (
                  <td key={s.key} className="px-3 py-3 text-center">
                    <div className="inline-flex justify-center">
                      <Toggle on={a[s.key]} disabled={savingKey === `${a.id}:${s.key}`} onClick={() => toggle(a.id, s.key)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={STREAMS.length + 1} className="px-4 py-6 text-center text-sm text-neutral-500 italic">No agencies yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-neutral-600 leading-relaxed">
        Note: &ldquo;Enquiries raise&rdquo; emails buyers directly, not just solicitors. The three
        streams were previously one hidden switch, so this is the first time they can be seen and set apart.
      </p>
    </div>
  );
}
