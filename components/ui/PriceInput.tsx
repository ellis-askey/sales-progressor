"use client";

import { NumericFormat } from "react-number-format";

type Props = {
  value?: number | null;        // stored in pence
  onChange?: (pence: number | null) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  variant?: "admin" | "referral";
};

export function PriceInput({
  value,
  onChange,
  placeholder = "e.g. 325,000",
  className = "",
  error,
  disabled,
  size = "md",
  variant = "admin",
}: Props) {
  const displayValue = value != null ? value / 100 : undefined;

  const inputClass =
    variant === "referral"
      ? `flex-1 text-sm bg-white/50 border border-white/30 rounded-lg px-3 py-2 text-slate-900/80 focus:outline-none focus:border-blue-400/60 ${className}`
      : size === "sm"
      ? `glass-input px-2 py-1 text-sm ${className}`
      : `glass-input px-3 py-2.5 text-sm ${className}`;

  return (
    <div className="relative">
      <NumericFormat
        value={displayValue ?? ""}
        onValueChange={({ floatValue }) => {
          onChange?.(floatValue != null ? Math.round(floatValue * 100) : null);
        }}
        thousandSeparator=","
        decimalScale={2}
        allowNegative={false}
        prefix="£"
        placeholder={`£${placeholder}`}
        inputMode="decimal"
        disabled={disabled}
        aria-invalid={!!error}
        className={inputClass}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
