"use client";

// components/account/v2/AgencyNameForm.tsx
//
// Director-only editor for Agency.name. Mirrors the ProfileFormPlain style:
// hairline-bordered input, coral primary button, dirty-check disables Save,
// no glass chrome. The on-blur titleCase normaliser matches the pattern in
// components/transactions-v2/form/AddressFields.tsx so what the director
// sees is what gets saved.

import { useState } from "react";
import { Buildings } from "@phosphor-icons/react";
import { updateAgencyNameAction } from "@/app/actions/agency";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { titleCase } from "@/lib/utils";

export function AgencyNameForm({ initialName }: { initialName: string }) {
  const { toast } = useAgentToast();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = name.trim() !== initialName.trim();
  const valid = name.trim().length > 0;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const res = await updateAgencyNameAction({ name: name.trim() });
      if (!res.ok) {
        setError(res.error);
      } else {
        toast.success("Agency name updated");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13.5,
    color: "#111827",
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.16)",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 120ms, box-shadow 120ms",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: 500,
    marginBottom: 5,
  };

  return (
    <AccountCard
      icon={<Buildings size={18} weight="bold" />}
      title="Agency details"
      subtitle="The agency name shown across Sales Progressor and in your client communications."
      headerAction={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || !valid}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "var(--agent-coral, #FF6B4A)",
            border: "none",
            borderRadius: 8,
            cursor: saving || !dirty || !valid ? "default" : "pointer",
            opacity: saving || !dirty || !valid ? 0.45 : 1,
            transition: "opacity 150ms, filter 150ms",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      }
    >
      <label style={labelStyle}>Agency name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={(e) => { if (e.target.value.trim()) setName(titleCase(e.target.value)); }}
        placeholder="e.g. Hartwell & Partners"
        autoComplete="organization"
        style={fieldStyle}
      />
      {error && <p style={{ fontSize: 12.5, color: "#dc2626", margin: "10px 0 0" }}>{error}</p>}
    </AccountCard>
  );
}
