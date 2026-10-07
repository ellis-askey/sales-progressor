"use client";

// components/progression/BusinessBillingPointForm.tsx
//
// The "Billing point" card on the owner's Business settings tab (D1). Controls
// WHEN a sale appears on the invoices the business sends its clients: in the
// month it exchanged (default) or the month it completed. It doesn't change the
// fee — just the timing. Owner-gated server-side by updateBusinessBillingPointAction.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { updateBusinessBillingPointAction } from "@/app/actions/progression-clients";

export function BusinessBillingPointForm({ initialBillAtCompletion }: { initialBillAtCompletion: boolean }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [billAtCompletion, setBillAtCompletion] = useState(initialBillAtCompletion);
  const [saving, setSaving] = useState(false);

  const dirty = billAtCompletion !== initialBillAtCompletion;
  const disabledSave = saving || !dirty;

  async function handleSave() {
    setSaving(true);
    const res = await updateBusinessBillingPointAction(billAtCompletion);
    setSaving(false);
    if (res.ok) { toast.success("Billing point saved"); router.refresh(); }
    else { toast.error(res.error); }
  }

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

  const Option = ({ value, title, desc }: { value: boolean; title: string; desc: string }) => {
    const on = billAtCompletion === value;
    return (
      <label
        className="bizbp-opt"
        data-on={on ? "true" : undefined}
        style={{
          display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 14px", cursor: "pointer",
          border: on ? "1.5px solid #FF6B4A" : "1px solid rgba(0,0,0,0.12)", borderRadius: 10,
          background: on ? "rgba(255,107,74,0.05)" : "#fff",
        }}
      >
        <input
          type="radio"
          name="billing-point"
          checked={on}
          onChange={() => setBillAtCompletion(value)}
          style={{ marginTop: 2, width: 16, height: 16, accentColor: "#FF6B4A", cursor: "pointer", flexShrink: 0 }}
        />
        <span>
          <span style={{ display: "block", fontSize: 13.5, color: "#111827", fontWeight: 600 }}>{title}</span>
          <span style={{ display: "block", fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.5 }}>{desc}</span>
        </span>
      </label>
    );
  };

  return (
    <AccountCard
      icon={<CalendarCheck size={20} weight="bold" />}
      title="Billing point"
      subtitle="Choose when a sale appears on the invoices you send your clients. This changes the timing only, not the fee."
      headerAction={saveButton("bizbp-save-desktop")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Option
          value={false}
          title="When a sale exchanges"
          desc="A sale is billed on the invoice for the month it exchanges. This is the default."
        />
        <Option
          value={true}
          title="When a sale completes"
          desc="A sale is billed on the invoice for the month it completes instead."
        />

        {/* Mobile-only Save (desktop Save lives in the card header). */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          {saveButton("bizbp-save-mobile")}
        </div>
      </div>

      <style>{`
        .bizbp-save-mobile { display: none; }
        @media (max-width: 640px) {
          .bizbp-save-desktop { display: none !important; }
          .bizbp-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
