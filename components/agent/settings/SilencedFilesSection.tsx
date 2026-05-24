"use client";

// Bulk-management lens for PropertyTransaction.clientEmailsPaused — same field
// the per-file "Pause client emails" toggle writes, just viewed across every
// self-managed file the agent has access to. Lets an agent realise "12 files
// have been silently chased through Christmas" without opening each one.
//
// Outsourced files are excluded — the existing pauseClientEmails action
// rejects them server-side. We don't show them in the picker either.

import { useState, useTransition } from "react";
import { pauseClientEmails, resumeClientEmails } from "@/app/actions/automation";

type FileRow = {
  id: string;
  propertyAddress: string;
  pausedAt: Date | null;
  pausedByName: string | null;
};

export function SilencedFilesSection({
  initialSilenced,
  silenceable,
}: {
  initialSilenced: FileRow[];
  // Active self-managed files NOT currently silenced — feeds the picker.
  silenceable: { id: string; propertyAddress: string }[];
}) {
  const [silenced, setSilenced] = useState<FileRow[]>(initialSilenced);
  const [available, setAvailable] = useState(silenceable);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function relTime(d: Date | null): string {
    if (!d) return "";
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.round(days / 7)} weeks ago`;
    return `${Math.round(days / 30)} months ago`;
  }

  function handleResume(file: FileRow) {
    if (isPending) return;
    setBusyId(file.id);
    startTransition(async () => {
      const result = await resumeClientEmails(file.id);
      if (result.ok) {
        setSilenced((rows) => rows.filter((r) => r.id !== file.id));
        setAvailable((rows) => [...rows, { id: file.id, propertyAddress: file.propertyAddress }].sort((a, b) => a.propertyAddress.localeCompare(b.propertyAddress)));
      }
      setBusyId(null);
    });
  }

  function handleSilence() {
    if (!pickerValue || isPending) return;
    const target = available.find((r) => r.id === pickerValue);
    if (!target) return;
    setBusyId(target.id);
    startTransition(async () => {
      const result = await pauseClientEmails(target.id);
      if (result.ok) {
        setSilenced((rows) => [
          { id: target.id, propertyAddress: target.propertyAddress, pausedAt: new Date(), pausedByName: "You" },
          ...rows,
        ]);
        setAvailable((rows) => rows.filter((r) => r.id !== target.id));
        setPickerValue("");
        setPickerOpen(false);
      }
      setBusyId(null);
    });
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-slate-900/80 mb-1">Silenced files</h2>
        <p className="text-xs text-slate-900/50">
          Files where automated client emails are paused. You can still pause or resume from the file itself — this is a faster way to see everything at once.
        </p>
      </div>

      {silenced.length === 0 ? (
        <p className="text-sm italic text-slate-900/40 py-2">
          No files are currently silenced. Use the picker below to silence one.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {silenced.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-orange-50/40 border border-orange-100"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900/80 truncate">{f.propertyAddress}</p>
                <p className="text-xs text-slate-900/50 mt-0.5">
                  Paused {relTime(f.pausedAt)}
                  {f.pausedByName ? ` by ${f.pausedByName}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleResume(f)}
                disabled={busyId === f.id}
                className="agent-btn agent-btn-xs agent-btn-ghost-bordered flex-shrink-0"
              >
                {busyId === f.id ? "…" : "Resume"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Picker — opens inline to keep the surface lightweight */}
      {!pickerOpen ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={available.length === 0}
          className="agent-link text-sm font-semibold disabled:opacity-40"
        >
          {available.length === 0
            ? "All your active files are already silenced"
            : "+ Silence another file"}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            className="glass-input flex-1 px-3 py-2 text-sm"
          >
            <option value="">— Choose a file —</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.propertyAddress}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSilence}
            disabled={!pickerValue || isPending}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            Silence
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setPickerValue("");
            }}
            disabled={isPending}
            className="agent-btn agent-btn-sm agent-btn-ghost"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
