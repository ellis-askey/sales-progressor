"use client";

// Director-only control in the Forecast header for the agency's monthly fees
// target. Unset → "Set a monthly target"; set → "Target £X/mo · Edit". Opens
// our anchored popover (same mechanics as the Completions menus) with an
// add-a-sale-formatted £ input, Save and Remove. Persists via
// setAgencyMonthlyFeeTarget; the forecast re-reads on refresh.

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Target } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { setAgencyMonthlyFeeTarget } from "@/app/actions/forecast-target";

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

export function MonthlyTargetMenu({ currentPence }: { currentPence: number | null }) {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const { open, pos, triggerRef, popRef, openPop, close } = useAnchoredPopover();
  const [pence, setPence] = useState<number | null>(currentPence);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gbp = (p: number) => Math.round(p / 100).toLocaleString("en-GB");

  async function save() {
    setSaving(true); setError(null);
    const res = await setAgencyMonthlyFeeTarget(pence);
    setSaving(false);
    if (res.ok) { close(); router.refresh(); } else setError(res.error);
  }
  async function remove() {
    setSaving(true); setError(null);
    const res = await setAgencyMonthlyFeeTarget(null);
    setSaving(false);
    if (res.ok) { setPence(null); close(); router.refresh(); } else setError(res.error);
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="fc-target-btn" aria-expanded={open} onClick={() => (open ? close() : openPop())}>
        <Target size={13} weight="regular" />
        {currentPence != null ? (
          <>Target £{gbp(currentPence)}/mo <span className="fc-target-edit">Edit</span></>
        ) : (
          "Set a monthly target"
        )}
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div data-theme={theme} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div ref={popRef} className="comp-pop agent-dropdown-in" style={{ width: 244 }}>
            <p className="comp-pop-label">Monthly fee target</p>
            <p className="fc-target-help">The fees you&rsquo;re aiming to exchange each month. We&rsquo;ll show how each month tracks against it.</p>
            <PriceInput value={pence} onChange={setPence} size="sm" className="w-full comp-fee-input" placeholder="8,000" disabled={saving} />
            <button type="button" className="comp-pop-cta" style={{ marginTop: 8 }} disabled={pence == null || saving} onClick={save}>
              {saving ? "Saving…" : "Save target"}
            </button>
            {currentPence != null && (
              <button type="button" className="fc-target-remove" disabled={saving} onClick={remove}>Remove target</button>
            )}
            {error && <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-danger)" }}>{error}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
