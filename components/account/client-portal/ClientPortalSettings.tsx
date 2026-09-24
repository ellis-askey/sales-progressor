"use client";

// Account → Client portal (director). Agency-wide "what your clients see"
// toggles. Each row saves on flip via setAgencyPortalDisplay; optimistic with
// revert on error. Only key-dates is overridable per file (in the file's Client
// settings drawer) — noted in its row.

import { useState, useTransition } from "react";
import { setAgencyPortalDisplay, type PortalDisplayField } from "@/app/actions/portal-display";

export type ClientPortalDisplay = {
  showPortalKeyDates: boolean;
  showPortalCosts: boolean;
  showPortalProgressPercent: boolean;
  showPortalWelcomeSheet: boolean;
};

const ROWS: { field: PortalDisplayField; label: string; sub: string; note?: string }[] = [
  {
    field: "showPortalKeyDates",
    label: "Key dates",
    sub: "The 12-week target and estimated exchange date on the client's portal.",
    note: "Can be overridden per sale in the file's Client settings.",
  },
  {
    field: "showPortalCosts",
    label: "Stamp duty & costs",
    sub: "The buyer's stamp-duty estimate and “Your costs” card.",
  },
  {
    field: "showPortalProgressPercent",
    label: "Progress figure",
    sub: "The numeric progress indicator on the overview.",
  },
  {
    field: "showPortalWelcomeSheet",
    label: "First-visit welcome",
    sub: "The one-time welcome introduction on a client's first visit.",
  },
];

function ToggleRow({
  field, label, sub, note, value, onChange, last,
}: {
  field: PortalDisplayField;
  label: string;
  sub: string;
  note?: string;
  value: boolean;
  onChange: (field: PortalDisplayField, next: boolean) => void;
  last: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setError(null);
    onChange(field, next);
    start(async () => {
      const res = await setAgencyPortalDisplay(field, next);
      if (!res.ok) {
        onChange(field, !next);
        setError(res.error);
      }
    });
  }

  return (
    <div className={`flex items-start justify-between gap-4 py-3.5${last ? "" : " border-b border-slate-200"}`}>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-slate-900">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">{sub}</p>
        {note && <p className="mt-1 text-[11.5px] italic text-slate-400">{note}</p>}
        {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={pending}
        onClick={toggle}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${value ? "bg-[#FF6B4A]" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
      </button>
    </div>
  );
}

export function ClientPortalSettings({ initial }: { initial: ClientPortalDisplay }) {
  const [state, setState] = useState<ClientPortalDisplay>(initial);
  const onChange = (field: PortalDisplayField, next: boolean) =>
    setState((s) => ({ ...s, [field]: next }));

  return (
    <div>
      {ROWS.map((r, i) => (
        <ToggleRow
          key={r.field}
          field={r.field}
          label={r.label}
          sub={r.sub}
          note={r.note}
          value={state[r.field]}
          onChange={onChange}
          last={i === ROWS.length - 1}
        />
      ))}
    </div>
  );
}
