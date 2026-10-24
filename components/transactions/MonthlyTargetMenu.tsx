"use client";

// Director-only control in the Forecast header for the agency's monthly fees
// target. Unset → "Set a monthly target"; set → "Target £X/mo · Edit". Opens
// the canonical Popover (portal + flip/shift + edge gutter + locked glass) with
// an add-a-sale-formatted £ input, Save and Remove. Persists via
// setAgencyMonthlyFeeTarget; the forecast re-reads on refresh.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "@phosphor-icons/react";
import { PriceInput } from "@/components/ui/PriceInput";
import { Popover } from "@/components/ui/Popover";
import { setAgencyMonthlyFeeTarget } from "@/app/actions/forecast-target";

export function MonthlyTargetMenu({ currentPence }: { currentPence: number | null }) {
  const router = useRouter();
  const [pence, setPence] = useState<number | null>(currentPence);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gbp = (p: number) => Math.round(p / 100).toLocaleString("en-GB");

  return (
    <Popover
      preset="popover"
      width={244}
      placement="bottom-end"
      trigger={
        <button type="button" className="fc-target-btn">
          <Target size={13} weight="regular" />
          {currentPence != null ? (
            <>Target £{gbp(currentPence)}/mo <span className="fc-target-edit">Edit</span></>
          ) : (
            "Set a monthly target"
          )}
        </button>
      }
    >
      {(close) => {
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
          </>
        );
      }}
    </Popover>
  );
}
