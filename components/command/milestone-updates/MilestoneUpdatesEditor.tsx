"use client";

// Command Centre editor for client-portal Updates copy. One row per milestone:
// edit the confirmation clause + both subtexts, with a live preview of how the
// header renders on each side. Save = upsert override (live now). Reset = drop.

import { useState } from "react";
import { portalConfirmationSentence } from "@/lib/updates-copy";

export type UpdateRow = {
  code: string;
  label: string;
  side: "vendor" | "purchaser";
  coreBase: string;
  coreOverride: string | null;
  subtextOwnBase: string;
  subtextOwnOverride: string | null;
  subtextOtherBase: string;
  subtextOtherOverride: string | null;
};

export function MilestoneUpdatesEditor({ rows }: { rows: UpdateRow[] }) {
  const buyers = rows.filter((r) => r.side === "purchaser");
  const sellers = rows.filter((r) => r.side === "vendor");
  return (
    <div className="space-y-8">
      <Group title="Buyer" rows={buyers} />
      <Group title="Seller" rows={sellers} />
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: UpdateRow[] }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h2>
      <div className="divide-y divide-neutral-800 overflow-hidden rounded-lg border border-neutral-800">
        {rows.map((r) => (
          <RowEditor key={r.code} row={r} />
        ))}
      </div>
    </div>
  );
}

function RowEditor({ row }: { row: UpdateRow }) {
  const [open, setOpen] = useState(false);
  const [core, setCore] = useState(row.coreOverride ?? row.coreBase);
  const [own, setOwn] = useState(row.subtextOwnOverride ?? row.subtextOwnBase);
  const [other, setOther] = useState(row.subtextOtherOverride ?? row.subtextOtherBase);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<null | "saved" | "reset" | "error">(null);
  const [overridden, setOverridden] = useState(
    !!(row.coreOverride || row.subtextOwnOverride || row.subtextOtherOverride),
  );

  const otherSide = row.side === "vendor" ? "purchaser" : "vendor";
  const ownHeader = portalConfirmationSentence({
    code: row.code, side: row.side, viewerSide: row.side,
    confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: row.label, coreOverride: core,
  });
  const otherHeader = portalConfirmationSentence({
    code: row.code, side: row.side, viewerSide: otherSide,
    confirmer: { kind: "agent", name: "Ellis Askey" }, milestoneName: row.label, coreOverride: core,
  });

  async function save() {
    setBusy(true); setSaved(null);
    try {
      const res = await fetch("/api/command/milestone-updates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: row.code, core, subtextOwn: own, subtextOther: other }),
      });
      if (res.ok) { setSaved("saved"); setOverridden(true); } else { setSaved("error"); }
    } catch { setSaved("error"); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true); setSaved(null);
    try {
      const res = await fetch("/api/command/milestone-updates/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: row.code }),
      });
      if (res.ok) {
        setCore(row.coreBase); setOwn(row.subtextOwnBase); setOther(row.subtextOtherBase);
        setSaved("reset"); setOverridden(false);
      } else { setSaved("error"); }
    } catch { setSaved("error"); } finally { setBusy(false); }
  }

  return (
    <div className="bg-neutral-950">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-900"
      >
        <span className="w-10 font-mono text-[11px] text-neutral-500">{row.code}</span>
        <span className="flex-1 text-sm text-neutral-200">{row.label}</span>
        {overridden && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">edited</span>
        )}
        <span className="text-neutral-600">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-4">
          {/* Live preview */}
          <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-neutral-500">Preview (client's own feed)</p>
            <p className="text-sm font-medium text-neutral-100">{ownHeader}</p>
            {own.trim() && <p className="mt-0.5 text-[13px] text-neutral-400">{own}</p>}
            <p className="mb-1 mt-3 text-[10px] uppercase tracking-wider text-neutral-500">Preview (other party's feed)</p>
            <p className="text-sm font-medium text-neutral-100">{otherHeader}</p>
            {other.trim() && <p className="mt-0.5 text-[13px] text-neutral-400">{other}</p>}
          </div>

          <Field
            label="Confirmation clause"
            help={'The part after "your" / "the seller\'s". e.g. "solicitor has ordered the searches"'}
            value={core} onChange={setCore} base={row.coreBase}
          />
          <Field label="Subtext (client's own feed)" value={own} onChange={setOwn} base={row.subtextOwnBase} textarea />
          <Field label="Subtext (other party's feed)" value={other} onChange={setOther} base={row.subtextOtherBase} textarea />

          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={reset} disabled={busy}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 disabled:opacity-50">
              Reset to default
            </button>
            {saved === "saved" && <span className="text-xs text-green-400">Saved — live on the portal now</span>}
            {saved === "reset" && <span className="text-xs text-neutral-400">Reset to default</span>}
            {saved === "error" && <span className="text-xs text-red-400">Something went wrong</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, help, value, onChange, base, textarea,
}: {
  label: string; help?: string; value: string; onChange: (v: string) => void; base: string; textarea?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-300">{label}</label>
      {help && <p className="mb-1.5 text-[11px] text-neutral-500">{help}</p>}
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none" />
      )}
      {base && <p className="mt-1 text-[11px] text-neutral-600">Default: {base}</p>}
    </div>
  );
}
