"use client";

import { useState, useTransition } from "react";
import { updateProviderFirm, toggleProviderFirmActive } from "@/app/actions/provider-firms";
import type { ProviderKind } from "@prisma/client";

type Initial = {
  kind: ProviderKind;
  name: string;
  email: string;
  phone: string | null;
  website: string | null;
  notes: string | null;
  active: boolean;
};

export function ProviderFirmEditor({ id, initial }: { id: string; initial: Initial }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [active, setActive] = useState(initial.active);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== initial.name ||
    email !== initial.email ||
    (phone || "") !== (initial.phone ?? "") ||
    (website || "") !== (initial.website ?? "") ||
    (notes || "") !== (initial.notes ?? "") ||
    active !== initial.active;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateProviderFirm(id, {
        kind: initial.kind,
        name,
        email,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        active,
      });
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(r.error);
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      const r = await toggleProviderFirmActive(id);
      if (r.ok) setActive((a) => !a);
    });
  }

  return (
    <div className="space-y-2.5">
      <TextField label="Firm name" value={name} onChange={setName} />
      <TextField label="Email (where quotes go)" value={email} onChange={setEmail} type="email" />
      <div className="grid grid-cols-2 gap-2.5">
        <TextField label="Phone" value={phone} onChange={setPhone} />
        <TextField label="Website" value={website} onChange={setWebsite} placeholder="https://" />
      </div>
      <div>
        <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
          Notes (shown to client under the firm card)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] resize-none"
          placeholder="e.g. RICS regulated, 15 years covering North London, fast turnaround"
        />
      </div>

      {error && <p className="text-[11px] text-[#fca5a5]">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={toggle}
          disabled={pending}
          className="text-[11px] text-[#737373] hover:text-[#d4d4d4] transition-colors disabled:opacity-40"
        >
          {active ? "Hide from clients" : "Show to clients"}
        </button>

        <div className="flex items-center gap-3">
          {saved && <span className="text-[11px] text-[#86efac]">Saved</span>}
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="px-3 py-1 rounded text-[12px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: dirty && !pending ? "#2563eb" : "#404040" }}
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] placeholder:text-[#404040]"
      />
    </div>
  );
}
