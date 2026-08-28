"use client";

// Command Centre → Agencies & agents → Weekly client update.
//
// The Saturday "quick check-in / all on track" client email. This surface is
// the one place to see what it does, who it reaches, and switch it on/off —
// master (all agencies) or per-agency. Sends are now logged, so the actual
// emails show in the Outbound tab and on each file's activity.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAgencyWeeklyUpdateAction, setAllWeeklyUpdatesAction } from "@/app/actions/agency-weekly-update";

export type WeeklyUpdateRow = { id: string; name: string; weeklyClientUpdatesEnabled: boolean };

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

export function WeeklyUpdateControl({
  agencies,
  eligibleThisWeek,
}: {
  agencies: WeeklyUpdateRow[];
  eligibleThisWeek: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<WeeklyUpdateRow[]>(agencies);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const allOn = rows.length > 0 && rows.every((r) => r.weeklyClientUpdatesEnabled);
  const anyOn = rows.some((r) => r.weeklyClientUpdatesEnabled);

  function toggleOne(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const next = !row.weeklyClientUpdatesEnabled;
    setBusy(id); setError(null);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, weeklyClientUpdatesEnabled: next } : r)));
    startTransition(async () => {
      const res = await updateAgencyWeeklyUpdateAction({ agencyId: id, value: next });
      if (!res.ok) { setError(res.error); setRows((prev) => prev.map((r) => (r.id === id ? { ...r, weeklyClientUpdatesEnabled: !next } : r))); }
      else router.refresh();
      setBusy((c) => (c === id ? null : c));
    });
  }

  function setAll(value: boolean) {
    setBusy("__all__"); setError(null);
    const prev = rows;
    setRows((p) => p.map((r) => ({ ...r, weeklyClientUpdatesEnabled: value })));
    startTransition(async () => {
      const res = await setAllWeeklyUpdatesAction({ value });
      if (!res.ok) { setError(res.error); setRows(prev); }
      else router.refresh();
      setBusy((c) => (c === "__all__" ? null : c));
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
      <div className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-100">Weekly client update</h2>
          <p className="text-[12px] text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            A Saturday-morning &ldquo;quick check-in&rdquo; email to clients whose file has gone quiet.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border ${allOn ? "text-emerald-400 bg-emerald-950/50 border-emerald-900" : anyOn ? "text-amber-400 bg-amber-950/50 border-amber-900" : "text-neutral-400 bg-neutral-800/60 border-neutral-700"}`}>
            {allOn ? "ON (all)" : anyOn ? "ON (some)" : "OFF"}
          </span>
        </div>
      </div>

      {/* What it does + conditions */}
      <div className="bg-neutral-950/50 border border-neutral-800 rounded-lg p-3.5 mb-4 text-[12px] text-neutral-400 leading-relaxed">
        <p className="text-neutral-300 font-semibold mb-1.5">What it sends</p>
        <p className="mb-2 italic text-neutral-500">&ldquo;Quick check-in on your sale at {"{address}"} — everything&rsquo;s progressing as it should. No news is genuinely good news…&rdquo; (the same generic reassurance to everyone; it reads nothing about the actual file).</p>
        <p className="text-neutral-300 font-semibold mb-1.5">When it fires</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Saturday 09:00, per agency below.</li>
          <li>Only files with <span className="text-neutral-300">no email to that client in the last 7 days</span> (targets the quiet ones).</li>
          <li>Only active files; only buyer/seller contacts with an email, not unsubscribed.</li>
        </ul>
        <p className="mt-2">Sends are now recorded — the actual emails appear in the <span className="text-neutral-300">Outbound</span> tab and on each file&rsquo;s activity.</p>
        <p className="mt-2 text-neutral-300"><span className="tabular-nums font-semibold">{eligibleThisWeek}</span> client{eligibleThisWeek === 1 ? "" : "s"} would receive it this Saturday (across agencies currently on).</p>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {/* Master */}
      <div className="flex items-center justify-between gap-4 py-2.5 px-3 rounded-lg bg-neutral-950/40 border border-neutral-800 mb-3">
        <div>
          <p className="text-[13px] font-semibold text-neutral-100">All agencies</p>
          <p className="text-[11px] text-neutral-500">Master switch — flips every agency at once.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setAll(false)} disabled={busy !== null || !anyOn} className="text-[12px] font-semibold px-2.5 py-1 rounded-md text-neutral-300 border border-neutral-700 hover:bg-neutral-800 disabled:opacity-40">Turn all off</button>
          <button type="button" onClick={() => setAll(true)} disabled={busy !== null || allOn} className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">Turn all on</button>
        </div>
      </div>

      {/* Per-agency */}
      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
        <table className="w-full text-[13px] min-w-[360px]">
          <tbody className="divide-y divide-neutral-800">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-900">
                <td className="px-4 py-3 text-neutral-200">{a.name}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex justify-end">
                    <Toggle on={a.weeklyClientUpdatesEnabled} disabled={busy === a.id || busy === "__all__"} onClick={() => toggleOne(a.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="px-4 py-6 text-center text-sm text-neutral-500 italic">No agencies yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
