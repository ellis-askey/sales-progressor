"use client";

import { ForecastHeatBand } from "@/components/hub/HubCharts";

// Prices in pence: £345,000 → 34_500_000.
const p = (pounds: number) => pounds * 100;
const FORECAST = [
  { label: "This wk", count: 2, isCurrentWeek: true,  valuePence: p(610_000),   files: [{ address: "14 Maple Drive, Bristol", pricePence: p(345_000) }, { address: "7 Orchard Road, Bath", pricePence: p(265_000) }] },
  { label: "+1w",     count: 4, isCurrentWeek: false, valuePence: p(1_240_000), files: [{ address: "22 Clifton Park, Bristol", pricePence: p(420_000) }, { address: "33 Park Street, Bristol", pricePence: p(380_000) }, { address: "8 Victoria Road, Bath", pricePence: p(240_000) }, { address: "5 Harbour Way, Bristol", pricePence: p(200_000) }] },
  { label: "+2w",     count: 1, isCurrentWeek: false, valuePence: p(295_000),   files: [{ address: "41 Redland Grove, Bristol", pricePence: p(295_000) }] },
  { label: "+3w",     count: 3, isCurrentWeek: false, valuePence: p(880_000),   files: [{ address: "12 Sydney Place, Bath", pricePence: p(360_000) }, { address: "3 Cotham Hill, Bristol", pricePence: p(280_000) }, { address: "19 Wells Road, Bath", pricePence: p(240_000) }] },
  { label: "+4w",     count: 1, isCurrentWeek: false, valuePence: p(310_000),   files: [{ address: "27 Gloucester Road, Bristol", pricePence: p(310_000) }] },
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
