"use client";

// The Completions card's little popup menus — "Change date" (a date field with
// the CTA stacked below, à la the enquiries backdate popover) and "Add fee" (the
// Fixed £ / % and + VAT / Inc VAT toggles stacked over an add-a-sale-formatted
// input, with the Save CTA in the menu). Both portal to <body> so the group
// card's overflow:hidden doesn't clip them, and both reuse the real actions
// (saveCompletionDateAction / saveAgentFeeAction). Styling in agent-system.css
// (.comp-pop*, .comp-seg*, .comp-fee-input, .comp-date-*).

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { saveCompletionDateAction, saveAgentFeeAction } from "@/app/actions/transactions";

function useAnchoredPopover() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const openPop = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      close();
    };
    const onScroll = () => close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [open, close]);

  return { open, pos, triggerRef, popRef, openPop, close };
}

export function DateMenu({ txId, currentIso, hasDate }: { txId: string; currentIso: string | null; hasDate: boolean }) {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const { open, pos, triggerRef, popRef, openPop, close } = useAnchoredPopover();
  const [iso, setIso] = useState(currentIso ? currentIso.split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() { const el = inputRef.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }
  async function save() {
    if (!iso) return;
    setSaving(true);
    try { await saveCompletionDateAction(txId, iso); close(); router.refresh(); } finally { setSaving(false); }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="comp-menu-trigger" aria-expanded={open} onClick={() => (open ? close() : openPop())}>
        {hasDate ? "Change date" : "Set date"}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div data-theme={theme} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div ref={popRef} className="comp-pop agent-dropdown-in">
            <p className="comp-pop-label">When&rsquo;s it completing?</p>
            <div className="comp-date-field" role="button" tabIndex={0} onClick={openPicker} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}>
              <CalendarBlank size={15} style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
              <input ref={inputRef} type="date" value={iso} onChange={(e) => setIso(e.target.value)} className="comp-date-input" />
            </div>
            <button type="button" className="comp-pop-cta" style={{ marginTop: 10 }} disabled={!iso || saving} onClick={save}>{saving ? "Saving…" : "Save date"}</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export function FeeMenu({
  txId, agentFeeAmount, agentFeePercent, agentFeeIsVatInclusive, purchasePrice,
}: {
  txId: string;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  purchasePrice: number | null;
}) {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const { open, pos, triggerRef, popRef, openPop, close } = useAnchoredPopover();
  const [feeType, setFeeType] = useState<"amount" | "percent">(agentFeePercent ? "percent" : "amount");
  const [amount, setAmount] = useState<number | null>(agentFeeAmount);
  const [percent, setPercent] = useState(agentFeePercent ? String(Number(agentFeePercent).toFixed(2)) : "");
  const [vat, setVat] = useState<"inclusive" | "exclusive">(agentFeeIsVatInclusive ? "inclusive" : "exclusive");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unset = agentFeeAmount == null && agentFeePercent == null;
  const canSave = feeType === "amount" ? amount != null : !!percent;
  // The £ this resolves to (% of the price, or the entered amount), split into
  // net + gross by the VAT toggle — the glance line under Save.
  const feePence = feeType === "amount" ? (amount ?? 0) : Math.round((purchasePrice ?? 0) * (parseFloat(percent) || 0) / 100);
  const netPence = vat === "inclusive" ? Math.round(feePence / 1.2) : feePence;
  const grossPence = vat === "inclusive" ? feePence : Math.round(feePence * 1.2);
  const gbp = (p: number) => Math.round(p / 100).toLocaleString("en-GB");

  async function save() {
    setSaving(true); setError(null);
    try {
      await saveAgentFeeAction({
        transactionId: txId,
        agentFeeAmount: feeType === "amount" ? amount : null,
        agentFeePercent: feeType === "percent" ? (parseFloat(percent || "0") || null) : null,
        agentFeeIsVatInclusive: vat === "inclusive",
      });
      close(); router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the fee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="comp-menu-trigger" aria-expanded={open} onClick={() => (open ? close() : openPop())}>
        {unset ? "+ Add fee" : "Edit fee"}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div data-theme={theme} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div ref={popRef} className="comp-pop agent-dropdown-in" style={{ width: 244 }}>
            <p className="comp-pop-label">Your commission</p>
            <div className="comp-seg">
              <button type="button" className={`comp-seg-btn${feeType === "amount" ? " on" : ""}`} onClick={() => setFeeType("amount")} disabled={saving}>Fixed £</button>
              <button type="button" className={`comp-seg-btn${feeType === "percent" ? " on" : ""}`} onClick={() => setFeeType("percent")} disabled={saving}>Percent %</button>
            </div>
            <div className="comp-seg" style={{ marginTop: 6 }}>
              <button type="button" className={`comp-seg-btn${vat === "exclusive" ? " on" : ""}`} onClick={() => setVat("exclusive")} disabled={saving}>+ VAT</button>
              <button type="button" className={`comp-seg-btn${vat === "inclusive" ? " on" : ""}`} onClick={() => setVat("inclusive")} disabled={saving}>Inc VAT</button>
            </div>
            <div style={{ marginTop: 8 }}>
              {feeType === "amount" ? (
                <PriceInput value={amount} onChange={setAmount} size="sm" className="w-full comp-fee-input" placeholder="1,500" disabled={saving} />
              ) : (
                <div className="comp-pct">
                  <input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="e.g. 1.5" inputMode="decimal" disabled={saving} className="comp-fee-input comp-pct-input" />
                  <span className="comp-pct-sign">%</span>
                </div>
              )}
            </div>
            <button type="button" className="comp-pop-cta" style={{ marginTop: 8 }} disabled={!canSave || saving} onClick={save}>{saving ? "Saving…" : "Save fee"}</button>
            {feePence > 0 && (
              <p className="comp-fee-net"><b>Net £{gbp(netPence)}</b> · £{gbp(grossPence)} inc VAT</p>
            )}
            {error && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-danger, #DC2626)" }}>{error}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
