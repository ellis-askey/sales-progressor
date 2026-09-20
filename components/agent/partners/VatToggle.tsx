"use client";

// Two-state VAT toggle for a referral fee: "+ VAT" (figure is ex VAT) or
// "inc VAT" (figure includes VAT). Referral income for a VAT-registered agency
// is always VATable, so there is no "no VAT" option. Styled to sit inline in the
// Partners fee rows (white/blue glass), mirroring the agent-fee VAT control.

import type { FeeVatTreatment } from "@prisma/client";

const OPTIONS: { key: FeeVatTreatment; label: string }[] = [
  { key: "plus", label: "+ VAT" },
  { key: "inc", label: "inc VAT" },
];

export function VatToggle({
  value,
  onChange,
  disabled,
}: {
  value: FeeVatTreatment;
  onChange: (v: FeeVatTreatment) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="VAT treatment"
      className="inline-flex flex-shrink-0 rounded-lg border border-white/30 bg-white/40 p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            disabled={disabled}
            aria-pressed={active}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-40 ${
              active
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-900/55 hover:text-slate-900/80"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
