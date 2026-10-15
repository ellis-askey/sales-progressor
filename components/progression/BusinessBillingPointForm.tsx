"use client";

// components/progression/BusinessBillingPointForm.tsx
//
// The "Billing point" card on the owner's Business settings tab (D1). Controls
// WHEN a sale appears on the invoices the business sends its clients: in the
// month it exchanged (default) or the month it completed. It doesn't change the
// fee — just the timing. Owner-gated server-side by updateBusinessBillingPointAction.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CheckCircle } from "@phosphor-icons/react";
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

  // Canonical option-select: brand-fill + tick on the chosen one, clean outline
  // otherwise, lift on hover. Matches the Email signature mode picker.
  const Option = ({ value, title, desc }: { value: boolean; title: string; desc: string }) => {
    const on = billAtCompletion === value;
    return (
      <button
        type="button"
        onClick={() => setBillAtCompletion(value)}
        className={`bizbp-opt${on ? " on" : ""}`}
        aria-pressed={on}
        style={{
          textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "13px 15px",
          border: on ? "1.5px solid transparent" : "1.5px solid var(--agent-border-default, rgba(0,0,0,0.14))",
          background: on ? "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))" : "#fff",
          boxShadow: on ? "0 4px 13px -2px rgba(var(--agent-coral-rgb, 255,107,74), 0.45), inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? "var(--agent-text-on-coral, #fff)" : "#111827" }}>{title}</span>
          <span style={{ display: "block", fontSize: 12.5, color: on ? "rgba(255,255,255,0.88)" : "#6b7280", marginTop: 2, lineHeight: 1.5 }}>{desc}</span>
        </span>
        {on && <CheckCircle size={20} weight="fill" color="var(--agent-text-on-coral, #fff)" style={{ flexShrink: 0 }} />}
      </button>
    );
  };

  return (
    <AccountCard
      icon={<CalendarCheck size={20} weight="bold" />}
      title="Billing point"
      subtitle="Choose when a sale is added to the invoices you send clients. This only changes when it's billed, not the fee."
      headerAction={saveButton("bizbp-save-desktop")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Option
          value={false}
          title="When a sale exchanges"
          desc="The sale is added to the invoice for the month it exchanges. This is the default."
        />
        <Option
          value={true}
          title="When a sale completes"
          desc="The sale is added to the invoice for the month it completes instead."
        />

        {/* Mobile-only Save (desktop Save lives in the card header). */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
          {saveButton("bizbp-save-mobile")}
        </div>
      </div>

      <style>{`
        .bizbp-opt { transition: background 160ms, border-color 150ms, box-shadow 220ms, transform 160ms; }
        .bizbp-opt:not(.on):hover { border-color: var(--agent-coral, #FF8A65); transform: translateY(-1px); }
        .bizbp-opt:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,107,74,0.3); }
        @media (prefers-reduced-motion: reduce) { .bizbp-opt { transition: none; } .bizbp-opt:hover { transform: none; } }
        .bizbp-save-mobile { display: none; }
        @media (max-width: 640px) {
          .bizbp-save-desktop { display: none !important; }
          .bizbp-save-mobile { display: inline-flex !important; }
        }
      `}</style>
    </AccountCard>
  );
}
