"use client";

import { useState } from "react";
import { fieldVerdict, type FieldMeta } from "@/lib/command/prospect-labels";

// One field in the drawer with research-aware treatment:
//  - verified/confirmed/plain → looks normal
//  - NEEDS_CHECK → an amber flag you can click to see the source + Confirm / Edit
//  - empty + expected → highlighted "Add …" so the eye is drawn to the gap
export function VerifiedField({ label, value, meta, expected, onConfirm, onEdit, editable = true }: {
  label: string;
  value: string | null;
  meta?: FieldMeta;
  expected?: boolean;
  onConfirm?: () => Promise<{ ok: boolean; error?: string }>;
  onEdit?: (value: string) => Promise<{ ok: boolean; error?: string }>;
  editable?: boolean;
}) {
  const verdict = fieldVerdict(value, meta, !!expected);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!onConfirm) return;
    setBusy(true); setError(null);
    const r = await onConfirm();
    setBusy(false);
    if (r.ok) setOpen(false); else setError(r.error ?? "Couldn't confirm.");
  }
  async function save() {
    if (!onEdit) return;
    setBusy(true); setError(null);
    const r = await onEdit(draft);
    setBusy(false);
    if (r.ok) { setEditing(false); setOpen(false); } else setError(r.error ?? "Couldn't save.");
  }
  function startEdit() { setDraft(value ?? ""); setEditing(true); setOpen(true); }

  return (
    <div className={`relative rounded-md px-2.5 py-1.5 border ${verdict === "missing" ? "border-amber-900/60 bg-amber-950/20" : "border-neutral-800/70 bg-neutral-900/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</span>
        <div className="flex items-center gap-1.5">
          {verdict === "flag" && (
            <button onClick={() => setOpen((o) => !o)} title="Needs checking" className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300">
              <span aria-hidden>⚑</span> check
            </button>
          )}
          {verdict !== "missing" && editable && onEdit && (
            <button onClick={startEdit} className="text-[10px] text-neutral-600 hover:text-neutral-300">edit</button>
          )}
        </div>
      </div>

      {verdict === "missing" ? (
        editable && onEdit ? (
          <button onClick={startEdit} className="mt-0.5 text-xs text-amber-400/90 hover:text-amber-300">+ Add {label.toLowerCase()}</button>
        ) : (
          <span className="mt-0.5 block text-xs text-amber-400/80">Nothing found</span>
        )
      ) : (
        <span className="mt-0.5 block text-xs text-neutral-200 break-words">{value}</span>
      )}

      {open && (
        <div className="absolute z-10 right-2 top-full mt-1 w-64 rounded-lg border border-neutral-700 bg-neutral-950 shadow-xl p-3 space-y-2">
          {meta && verdict === "flag" && (
            <div className="space-y-0.5 text-[11px] text-neutral-400">
              {meta.note && <p className="text-amber-300/90">{meta.note}</p>}
              {meta.sourceName && <p>Source: {meta.sourceName}{meta.confidence ? ` · ${meta.confidence} confidence` : ""}</p>}
              {meta.sourceUrl && <a href={meta.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{meta.sourceUrl}</a>}
              {meta.researchedAt && <p className="text-neutral-600">Researched {new Date(meta.researchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}</p>}
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="w-full text-xs bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-neutral-200 focus:outline-none focus:border-[#2563eb]" />
              <div className="flex gap-2">
                <button onClick={save} disabled={busy} className="text-[11px] px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40">{busy ? "…" : "Save + confirm"}</button>
                <button onClick={() => { setEditing(false); setOpen(false); }} className="text-[11px] px-2 py-1 rounded text-neutral-500 hover:text-neutral-300">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {verdict === "flag" && onConfirm && <button onClick={confirm} disabled={busy} className="text-[11px] px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900 disabled:opacity-40">{busy ? "…" : "Confirm"}</button>}
              {editable && onEdit && <button onClick={startEdit} className="text-[11px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700">Edit</button>}
              <button onClick={() => setOpen(false)} className="text-[11px] px-2 py-1 rounded text-neutral-500 hover:text-neutral-300">Close</button>
            </div>
          )}
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
