"use client";

// components/command/SolicitorCadencePanel.tsx
//
// Command Centre editor for the PLATFORM-WIDE solicitor chase cadence
// (SolicitorChaseSettings singleton). This timing applies to every agency;
// individual agencies can only turn solicitor chasing on/off, not retime it.
// Previously this lived on an agency-facing page (wrong — it's a global
// setting), retired in the settings consolidation and re-homed here. Dark,
// utilitarian Command Centre styling (Law 9); saves via the existing
// superadmin-allowed updateSolicitorCadence action.

import { useState } from "react";
import { updateSolicitorCadence, type SolicitorCadenceState } from "@/app/actions/automation";

function NumberField({ label, hint, value, min, onChange }: { label: string; hint: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-neutral-300">{label}</span>
      <span className="block text-[11px] text-neutral-500 mb-1.5">{hint}</span>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-blue-500"
      />
    </label>
  );
}

export function SolicitorCadencePanel({ initial }: { initial: SolicitorCadenceState }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [grace, setGrace] = useState(initial.graceWorkingDays);
  const [repeat, setRepeat] = useState(initial.repeatDays);
  const [maxChases, setMaxChases] = useState(initial.maxChases);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty =
    enabled !== initial.enabled ||
    grace !== initial.graceWorkingDays ||
    repeat !== initial.repeatDays ||
    maxChases !== initial.maxChases;

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await updateSolicitorCadence({ enabled, graceWorkingDays: grace, repeatDays: repeat, maxChases });
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: res.error ?? "Couldn't save." });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-6 py-6 max-w-lg space-y-5">
      {/* Master default */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-neutral-200">Send solicitor chases by default</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">The platform default. Agencies still override on/off for their own files.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-neutral-700"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "left-0.5 translate-x-5" : "left-0.5"}`} />
        </button>
      </div>

      <div className="h-px bg-neutral-800" />

      <div className="flex flex-wrap gap-6">
        <NumberField label="First nudge after" hint="Working days" value={grace} min={1} onChange={setGrace} />
        <NumberField label="Repeat every" hint="Days" value={repeat} min={2} onChange={setRepeat} />
        <NumberField label="Stop after" hint="Nudges" value={maxChases} min={1} onChange={setMaxChases} />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-default"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {msg && (
          <span className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
