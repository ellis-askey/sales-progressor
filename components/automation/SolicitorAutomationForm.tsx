"use client";

// Solicitor confirmation emails — on/off switch + soft cadence editor.
// Global settings (one row for the whole platform). The switch is the safe
// go-live control: off until turned on here. See the client form above for
// the parallel per-milestone client controls.

import { useState, useTransition } from "react";
import { updateSolicitorCadence, type SolicitorCadenceState } from "@/app/actions/automation";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function SolicitorAutomationForm({ initial }: { initial: SolicitorCadenceState }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [grace, setGrace] = useState(initial.graceWorkingDays);
  const [repeat, setRepeat] = useState(initial.repeatDays);
  const [maxChases, setMaxChases] = useState(initial.maxChases);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useAgentToast();

  const dirty =
    enabled !== initial.enabled ||
    grace !== initial.graceWorkingDays ||
    repeat !== initial.repeatDays ||
    maxChases !== initial.maxChases;

  function save() {
    setError(null);
    start(async () => {
      const r = await updateSolicitorCadence({
        enabled,
        graceWorkingDays: grace,
        repeatDays: repeat,
        maxChases,
      });
      if (r.ok) toast.success("Solicitor email settings saved");
      else {
        setError(r.error);
        toast.error("Couldn't save — check the values");
      }
    });
  }

  return (
    <div className="mt-8 rounded-xl border border-black/10 p-5" style={{ background: "var(--agent-surface-elevated)" }}>
      <h2 className="text-base font-semibold" style={{ color: "var(--agent-text-primary)" }}>
        Solicitor confirmation emails
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--agent-text-muted)" }}>
        Automatically ask solicitors to confirm the steps they handle. Sent from your verified email.
      </p>

      {/* Master on/off */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium" style={{ color: "var(--agent-text-primary)" }}>
            Send solicitor emails
          </div>
          <div className="text-xs" style={{ color: "var(--agent-text-muted)" }}>
            {enabled ? "On — solicitors will be emailed on the schedule below." : "Off — no solicitor emails are sent."}
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className="relative inline-flex flex-shrink-0 cursor-pointer rounded-full transition-colors"
          style={{ height: 24, width: 42, background: enabled ? "var(--agent-coral, #FF6B4A)" : "rgba(15,23,42,0.20)" }}
          aria-label={enabled ? "Turn solicitor emails off" : "Turn solicitor emails on"}
        >
          <span
            className="inline-block rounded-full bg-white shadow transition-transform"
            style={{ height: 18, width: 18, marginTop: 3, transform: enabled ? "translateX(21px)" : "translateX(3px)" }}
          />
        </button>
      </div>

      {/* Cadence numbers */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <NumberField
          label="First nudge after"
          suffix="working days"
          value={grace}
          min={1}
          onChange={setGrace}
          hint="How long a step can sit before the first reminder."
        />
        <NumberField
          label="Repeat every"
          suffix="days"
          value={repeat}
          min={2}
          onChange={setRepeat}
          hint="Gap between reminders if there's no reply."
        />
        <NumberField
          label="Stop after"
          suffix="nudges"
          value={maxChases}
          min={1}
          onChange={setMaxChases}
          hint="Then the file is flagged to the team instead."
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="agent-btn agent-btn-primary"
          style={{ opacity: pending || !dirty ? 0.55 : 1 }}
        >
          {pending ? "Saving…" : "Save solicitor settings"}
        </button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  min,
  onChange,
  hint,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--agent-text-muted)" }}>
        {label}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, parseInt(e.target.value || String(min), 10)))}
          className="glass-input w-20"
          style={{ padding: "8px 10px", fontSize: 14 }}
        />
        <span className="text-xs" style={{ color: "var(--agent-text-muted)" }}>{suffix}</span>
      </span>
      <span className="mt-1 block text-xs" style={{ color: "var(--agent-text-muted)" }}>{hint}</span>
    </label>
  );
}
