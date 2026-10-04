"use client";

// components/progression/BusinessVatForm.tsx
//
// The "VAT" card on the owner's Business settings tab (audit C2b). Controls VAT on
// the invoices the business sends ITS clients: when registered, VAT is added on top
// of the rate-card fee and the VAT number prints on the invoice. Independent of what
// the business pays TSP. Owner-gated server-side by updateBusinessVatAction.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { updateBusinessVatAction } from "@/app/actions/progression-clients";

export function BusinessVatForm({
  initialRegistered,
  initialVatNumber,
  initialRatePercent,
}: {
  initialRegistered: boolean;
  initialVatNumber: string;
  initialRatePercent: string; // e.g. "20"
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [registered, setRegistered] = useState(initialRegistered);
  const [vatNumber, setVatNumber] = useState(initialVatNumber);
  const [ratePercent, setRatePercent] = useState(initialRatePercent || "20");
  const [saving, setSaving] = useState(false);

  const dirty =
    registered !== initialRegistered ||
    vatNumber.trim() !== initialVatNumber.trim() ||
    (registered && ratePercent.trim() !== initialRatePercent.trim());
  const invalid = registered && (vatNumber.trim().length === 0 || !Number.isFinite(parseFloat(ratePercent)));
  const disabledSave = saving || !dirty || invalid;

  async function handleSave() {
    if (invalid) return;
    setSaving(true);
    const res = await updateBusinessVatAction(registered, vatNumber, ratePercent);
    setSaving(false);
    if (res.ok) { toast.success("VAT settings saved"); router.refresh(); }
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
      icon={<Receipt size={20} weight="bold" />}
      title="VAT"
      subtitle="If your business is VAT registered, we'll add VAT to the invoices you send your clients and show your VAT number."
      headerAction={saveButton("bizvat-save-desktop")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={registered}
            onChange={(e) => setRegistered(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "#FF6B4A", cursor: "pointer" }}
          />
          <span style={{ fontSize: 13.5, color: "#111827", fontWeight: 500 }}>My business is VAT registered</span>
        </label>

        {registered && (
          <div className="bizvat-grid">
            <div>
              <label style={labelStyle}>VAT number</label>
              <input
                type="text"
                value={vatNumber}
                maxLength={30}
                onChange={(e) => setVatNumber(e.target.value)}
                placeholder="e.g. GB123456789"
                className="account-input"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>VAT rate</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  value={ratePercent}
                  min="0"
                  max="100"
                  step="0.5"
                  inputMode="decimal"
                  onChange={(e) => setRatePercent(e.target.value)}
                  className="account-input"
                  style={{ ...fieldStyle, maxWidth: 110 }}
                />
                <span style={{ fontSize: 15, fontWeight: 600, color: "#9ca3af" }}>%</span>
              </div>
            </div>
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11.5, color: "#9ca3af", lineHeight: 1.5 }}>
          {registered
            ? "VAT is added on top of your rate-card fee for each sale on the invoice."
            : "Leave this off if you're not VAT registered. Your invoices show the fee as the total, with no VAT line."}
        </p>

        {/* Mobile-only Save (desktop Save lives in the card header). */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {saveButton("bizvat-save-mobile")}
        </div>
      </div>

      <style>{`
        .bizvat-grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 640px) { .bizvat-grid { grid-template-columns: 1fr; } }
        .bizvat-save-mobile { display: none; }
        @media (max-width: 640px) {
          .bizvat-save-desktop { display: none !important; }
          .bizvat-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
