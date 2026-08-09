"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProviderFirm } from "@/app/actions/provider-firms";

export function NewProviderForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && !pending;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createProviderFirm({
        kind: "surveyor",
        name,
        email,
        phone: phone || null,
        website: website || null,
        notes: null,
        active: true,
      });
      if (r.ok) {
        router.push(`/command/providers/${r.data.id}`);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="border border-[#262626] rounded-md bg-[#0f0f0f] p-3">
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <TextField label="Firm name" value={name} onChange={setName} required />
        <TextField label="Email" value={email} onChange={setEmail} required type="email" />
        <TextField label="Phone" value={phone} onChange={setPhone} />
        <TextField label="Website" value={website} onChange={setWebsite} placeholder="https://" />
      </div>
      {error && (
        <p className="text-[11px] text-[#fca5a5] mb-2">{error}</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#525252]">
          Kind defaults to <span className="text-[#a3a3a3]">surveyor</span>. Coverage + service types + logo on the detail page after saving.
        </p>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="px-3 py-1 rounded text-[12px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: canSubmit ? "#2563eb" : "#404040" }}
        >
          {pending ? "Adding…" : "Add firm"}
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
        {label} {required && <span className="text-[#fca5a5]">*</span>}
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
