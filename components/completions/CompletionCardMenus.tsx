"use client";

// The Completions card's little popup menus — "Change date" (a date field with
// the CTA stacked below, à la the enquiries backdate popover) and "Add fee" (the
// Fixed £ / % and + VAT / Inc VAT toggles stacked over an add-a-sale-formatted
// input, with the Save CTA in the menu). Both ride the canonical Popover
// primitive (portal to <body> so the group card's overflow:hidden doesn't clip
// them, flip/shift, edge gutter, locked glass), and both reuse the real actions
// (saveCompletionDateAction / saveAgentFeeAction). Styling in agent-system.css
// (.comp-pop-label, .comp-seg*, .comp-fee-input, .comp-date-*).

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { Popover } from "@/components/ui/Popover";
import { saveCompletionDateAction, saveAgentFeeAction } from "@/app/actions/transactions";

export function DateMenu({ txId, currentIso, hasDate }: { txId: string; currentIso: string | null; hasDate: boolean }) {
  const router = useRouter();
  const [iso, setIso] = useState(currentIso ? currentIso.split("T")[0] : "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() { const el = inputRef.current; if (!el) return; try { el.showPicker(); } catch { el.focus(); } }

  return (
    <Popover
      preset="popover"
      width={220}
      placement="bottom-end"
      trigger={
        <button type="button" className="comp-menu-trigger">
          {hasDate ? "Change date" : "Set date"}
        </button>
      }
    >
      {(close) => {
        async function save() {
          if (!iso) return;
          setSaving(true);
          try { await saveCompletionDateAction(txId, iso); close(); router.refresh(); } finally { setSaving(false); }
        }
        return (
          <>
            <p className="comp-pop-label">When&rsquo;s it completing?</p>
            <div className="comp-date-field" role="button" tabIndex={0} onClick={openPicker} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(); } }}>
              <CalendarBlank size={15} style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
              <input ref={inputRef} type="date" value={iso} onChange={(e) => setIso(e.target.value)} className="comp-date-input" />
            </div>
            <button type="button" className="comp-pop-cta" style={{ marginTop: 10 }} disabled={!iso || saving} onClick={save}>{saving ? "Saving…" : "Save date"}</button>
          </>
        );
      }}
    </Popover>
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

  return (
    <Popover
      preset="popover"
      width={244}
      placement="bottom-end"
      trigger={
        <button type="button" className="comp-menu-trigger">
          {unset ? "+ Add fee" : "Edit fee"}
        </button>
      }
    >
      {(close) => {
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
          </>
        );
      }}
    </Popover>
  );
}
