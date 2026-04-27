"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveAgentFeeAction } from "@/app/actions/transactions";
import { PriceInput } from "@/components/ui/PriceInput";

type Props = {
  id: string;
  propertyAddress: string;
  ownerLine: string | null;
  awaitingAssignment?: boolean;
  txBasePath: string;
};

export function MissingFeeRow({ id, propertyAddress, ownerLine, awaitingAssignment = false, txBasePath }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [feeType, setFeeType] = useState<"amount" | "percent">("amount");
  const [amountPence, setAmountPence] = useState<number | null>(null);
  const [percentStr, setPercentStr] = useState("");
  const [vat, setVat] = useState<"exclusive" | "inclusive">("exclusive");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, isMobile]);

  function reset() {
    setFeeType("amount");
    setAmountPence(null);
    setPercentStr("");
    setVat("exclusive");
    setError(null);
  }

  function handleOpen() {
    reset();
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  const canSave = feeType === "amount" ? amountPence != null : !!percentStr && !isNaN(parseFloat(percentStr));

  function handleSave() {
    if (!canSave) return;
    const amount = feeType === "amount" ? amountPence : null;
    const percent = feeType === "percent" ? parseFloat(percentStr) : null;
    setError(null);
    startTransition(async () => {
      try {
        await saveAgentFeeAction({
          transactionId: id,
          agentFeeAmount: amount,
          agentFeePercent: percent,
          agentFeeIsVatInclusive: vat === "inclusive",
        });
        setOpen(false);
        setDismissed(true);
        router.refresh();
      } catch {
        setError("Failed to save. Try again.");
      }
    });
  }

  if (dismissed) return null;

  const toggleBtn = (type: "amount" | "percent", label: string) => (
    <button
      onClick={() => setFeeType(type)}
      className={`flex-1 py-1 text-xs rounded border transition-colors ${
        feeType === type
          ? "bg-blue-50 border-blue-300 text-blue-700"
          : "border-white/30 text-slate-900/50 bg-white/30"
      }`}
    >
      {label}
    </button>
  );

  const feeForm = (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {toggleBtn("amount", "Fixed £")}
        {toggleBtn("percent", "%")}
      </div>

      {feeType === "amount" ? (
        <PriceInput value={amountPence} onChange={setAmountPence} size="sm" placeholder="1,500" />
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={percentStr}
            onChange={(e) => setPercentStr(e.target.value)}
            placeholder="e.g. 1.5"
            inputMode="decimal"
            className="glass-input w-full px-2 py-1 text-sm"
          />
          <span className="text-xs text-slate-900/50 flex-shrink-0">%</span>
        </div>
      )}

      <select
        value={vat}
        onChange={(e) => setVat(e.target.value as "exclusive" | "inclusive")}
        className="glass-input w-full px-2 py-1 text-xs"
      >
        <option value="exclusive">+ VAT</option>
        <option value="inclusive">Inc VAT</option>
      </select>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleSave}
          disabled={isPending || !canSave}
          className="flex-1 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl transition-colors"
        >
          {isPending ? "…" : "Save"}
        </button>
        <button
          onClick={handleClose}
          className="flex-1 py-1.5 text-xs text-slate-900/50 hover:text-slate-900/80 glass-subtle rounded-xl"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-[11px] sm:gap-4">
      {/* Address + owner */}
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {propertyAddress}
        </p>
        {ownerLine && (
          <p style={{ margin: "2px 0 0", fontSize: 11, color: awaitingAssignment ? "var(--agent-warning)" : "var(--agent-text-muted)" }}>
            {ownerLine}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* Set fee — popover anchor */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={handleOpen}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", background: "none", border: "none", cursor: "pointer", padding: "6px 0", minHeight: 36, display: "flex", alignItems: "center" }}
          >
            Set fee →
          </button>

          {/* Desktop popover — opens upward so it's never clipped at page bottom */}
          {mounted && open && !isMobile && (
            <div style={{
              position: "absolute", right: 0, bottom: "calc(100% + 6px)", zIndex: 1000,
              background: "white", borderRadius: 12,
              boxShadow: "0 8px 30px rgba(0,0,0,0.13)", border: "1px solid rgba(0,0,0,0.07)",
              padding: 14, width: 230,
            }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Set agent fee</p>
              {feeForm}
            </div>
          )}
        </div>

        {/* View file — secondary */}
        <Link
          href={`${txBasePath}/${id}`}
          style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none", padding: "6px 0", minHeight: 36, display: "flex", alignItems: "center" }}
        >
          View file →
        </Link>
      </div>

      {/* Mobile bottom sheet */}
      {mounted && open && isMobile && createPortal(
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.40)" }}
          onClick={handleClose}
        >
          <div
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "white", borderRadius: "20px 20px 0 0",
              padding: "20px 24px 36px", maxHeight: "80vh", overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "0 auto 16px" }} />
            <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>Set agent fee</p>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {propertyAddress}
            </p>
            {feeForm}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
