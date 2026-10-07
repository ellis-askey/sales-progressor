"use client";

// components/progression/BusinessIdentityForm.tsx
//
// The "Business" tab of the owner's settings area: edit the business's own name
// and its short display label (used where the full name is too long, e.g. the
// file's "Managed by …" badge). Self-cards via AccountCard so the Save button
// sits top-right on desktop and drops below on mobile — same shape as
// ProfileFormPlain. Owner-gated server-side by updateBusinessIdentityAction.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Buildings } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { updateBusinessIdentityAction } from "@/app/actions/progression-clients";
import { titleCaseKeepAcronyms } from "@/lib/utils";

export function BusinessIdentityForm({
  initialName,
  initialShortName,
}: {
  initialName: string;
  initialShortName: string;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [shortName, setShortName] = useState(initialShortName);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== initialName.trim() || shortName.trim() !== initialShortName.trim();
  const disabledSave = saving || !dirty || name.trim().length < 2;

  async function handleSave() {
    if (name.trim().length < 2) return;
    setSaving(true);
    const res = await updateBusinessIdentityAction(name, shortName);
    setSaving(false);
    if (res.ok) { toast.success("Business details saved"); router.refresh(); }
    else { toast.error(res.error); }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 13.5, color: "#111827",
    background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 10, color: "#6b7280", textTransform: "uppercase",
    letterSpacing: 0.7, fontWeight: 500, marginBottom: 5,
  };

  const saveButton = (cls: string) => (
    <button
      type="button"
      onClick={handleSave}
      disabled={disabledSave}
      className={`account-btn-primary ${cls}`}
      style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: disabledSave ? "default" : "pointer" }}
    >
      {saving ? "Saving…" : "Save changes"}
    </button>
  );

  return (
    <AccountCard
      icon={<Buildings size={20} weight="bold" />}
      title="Your business"
      subtitle="This is the business name your clients, buyers and sellers will see."
      headerAction={saveButton("bizid-save-desktop")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="bizid-grid">
          <div>
            <label style={labelStyle}>Business name</label>
            <input
              type="text"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((t) => titleCaseKeepAcronyms(t))}
              placeholder="e.g. Hamptons Progression"
              className="account-input"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Short name <span style={{ textTransform: "none", letterSpacing: 0, color: "#9ca3af" }}>· optional</span></label>
            <input
              type="text"
              value={shortName}
              maxLength={40}
              onChange={(e) => setShortName(e.target.value)}
              onBlur={() => setShortName((t) => titleCaseKeepAcronyms(t))}
              placeholder="A shorter label for tight spaces"
              className="account-input"
              style={fieldStyle}
            />
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 11.5, color: "#9ca3af", lineHeight: 1.5 }}>
          The short name is used where the full name is too long, such as the &ldquo;Managed by&rdquo; badge on a sale. Leave it blank to always use your full business name.
        </p>

        {/* Mobile-only Save (desktop Save lives in the card header). */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {saveButton("bizid-save-mobile")}
        </div>
      </div>

      <style>{`
        .bizid-grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 640px) { .bizid-grid { grid-template-columns: 1fr; } }
        .bizid-save-mobile { display: none; }
        @media (max-width: 640px) {
          .bizid-save-desktop { display: none !important; }
          .bizid-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
