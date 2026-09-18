"use client";

import { ForecastHeatBand } from "@/components/hub/HubCharts";

// Fees in pence (commission + referrals − our fee): £4,140 → 414_000.
const p = (pounds: number) => pounds * 100;
const FORECAST = [
  { label: "This wk", count: 2, isCurrentWeek: true,  feesPence: p(7_320),  files: [{ address: "14 Maple Drive, Bristol", feePence: p(4_140) }, { address: "7 Orchard Road, Bath", feePence: p(3_180) }] },
  { label: "+1w",     count: 4, isCurrentWeek: false, feesPence: p(14_880), files: [{ address: "22 Clifton Park, Bristol", feePence: p(5_040) }, { address: "33 Park Street, Bristol", feePence: p(4_560) }, { address: "8 Victoria Road, Bath", feePence: p(2_880) }, { address: "5 Harbour Way, Bristol", feePence: p(2_400) }] },
  { label: "+2w",     count: 1, isCurrentWeek: false, feesPence: p(3_540),  files: [{ address: "41 Redland Grove, Bristol", feePence: p(3_540) }] },
  { label: "+3w",     count: 3, isCurrentWeek: false, feesPence: p(10_560), files: [{ address: "12 Sydney Place, Bath", feePence: p(4_320) }, { address: "3 Cotham Hill, Bristol", feePence: p(3_360) }, { address: "19 Wells Road, Bath", feePence: p(2_880) }] },
  { label: "+4w",     count: 1, isCurrentWeek: false, feesPence: p(3_720),  files: [{ address: "27 Gloucester Road, Bristol", feePence: p(3_720) }] },
];

export function ExchangeForecastHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ padding: "8px 0" }}>
      <ForecastHeatBand data={FORECAST} />
      <div style={{
        display: "flex", gap: 16, marginTop: 10,
        fontSize: 11, color: "var(--agent-text-muted)",
      }}>
        <span>This week: <strong style={{ color: "var(--agent-coral)" }}>2 exchanges</strong></span>
        <span>Next 30 days: <strong>11 exchanges</strong></span>
      </div>
    </div>
  );
}
