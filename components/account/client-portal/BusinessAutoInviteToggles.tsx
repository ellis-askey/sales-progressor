"use client";

// Settings → Client portal (business owner): the "Inviting clients" controls.
// Splits the auto-invite decision by who added the sale — an agency handed it
// over vs the SP added it themselves — because the welcome is this business's own
// client email. Governs every file this business progresses. Two optimistic
// toggles sharing the ClientPortalSettings switch styling.

import { useState, useTransition } from "react";
import { setBusinessAutoInvite } from "@/app/actions/progression-clients";

type Field = "autoInviteOnAgentAdd" | "autoInviteOnOwnAdd";

function Row({
  field, label, sub, value, onChange, last,
}: {
  field: Field; label: string; sub: string; value: boolean;
  onChange: (f: Field, next: boolean) => void; last: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !value;
    setError(null);
    onChange(field, next);
    start(async () => {
      const res = await setBusinessAutoInvite(field, next);
      if (!res.ok) { onChange(field, !next); setError(res.error); }
    });
  }

  return (
    <div className={`flex items-start justify-between gap-4 py-4${last ? "" : " border-b border-slate-200"}`}>
      <div className="min-w-0">
        <p className="text-[14px] font-bold text-slate-900">{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 max-w-xl">{sub}</p>
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

export function BusinessAutoInviteToggles({
  initial,
}: {
  initial: { autoInviteOnAgentAdd: boolean; autoInviteOnOwnAdd: boolean };
}) {
  const [state, setState] = useState(initial);
  const onChange = (f: Field, next: boolean) => setState((s) => ({ ...s, [f]: next }));

  return (
    <div>
      <Row
        field="autoInviteOnAgentAdd"
        label="When an agent adds the sale"
        sub="An agency adds a sale and hands it to you. We'll email the buyer and seller their portal link straight away so they're ready to go."
        value={state.autoInviteOnAgentAdd}
        onChange={onChange}
        last={false}
      />
      <Row
        field="autoInviteOnOwnAdd"
        label="When you add the sale"
        sub="You add a sale yourself. Turn this off to set the file up quietly first and send the invite when you're ready."
        value={state.autoInviteOnOwnAdd}
        onChange={onChange}
        last
      />
    </div>
  );
}
