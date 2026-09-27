import Link from "next/link";
import {
  getRevenueDashboard,
  formatGBP,
  formatShortDate,
  type RevenueLine,
  type ReferralLine,
} from "@/lib/command/revenue";
import { parseMode, parseAgencies } from "@/lib/command/scope";

export const dynamic = "force-dynamic";

// Statement-style drill-down behind the Banked / Pipeline / Forecast KPIs: the
// exact sales (and, for money in, the provider referrals) that make up each
// number, so it reads like a monthly invoice to yourself.
const META: Record<"banked" | "pipeline" | "forecast", { title: string; blurb: string }> = {
  banked: { title: "Banked this month", blurb: "Every sale fee invoiced so far this month, plus referral income from providers." },
  pipeline: { title: "Pipeline this month", blurb: "Active sales predicted to exchange this month, at their estimated fee." },
  forecast: { title: "Forecast total", blurb: "This month's banked, its pipeline, and referral income if it all lands." },
};

function sum(lines: { pence: number }[]): number {
  return lines.reduce((s, l) => s + l.pence, 0);
}

export default async function RevenueBreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const metric = sp.metric === "pipeline" || sp.metric === "forecast" ? sp.metric : "banked";
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const data = await getRevenueDashboard({ mode, agencyIds });
  const meta = META[metric];

  // Sale-fee sections per metric.
  const saleSections: { heading: string; lines: RevenueLine[]; predicted?: boolean }[] =
    metric === "pipeline"
      ? [{ heading: "Predicted sale fees", lines: data.pipelineThisMonthLines, predicted: true }]
      : metric === "forecast"
        ? [
            { heading: "Banked so far", lines: data.bankedLines },
            { heading: "Pipeline (predicted)", lines: data.pipelineThisMonthLines, predicted: true },
          ]
        : [{ heading: "Sale fees banked", lines: data.bankedLines }];

  // Referral income shown on money-in views (banked + forecast).
  const showReferrals = metric !== "pipeline";
  const referralTotal = sum(data.referralLines);
  const grandTotal = saleSections.reduce((s, sec) => s + sum(sec.lines), 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/command/revenue" className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
          ← Revenue
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-100">{meta.title} · breakdown</h1>
        <p className="mt-1 text-sm text-neutral-400">{meta.blurb}</p>
      </div>

      {/* Sale-fee sections */}
      {saleSections.map((sec) => (
        <section key={sec.heading}>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">{sec.heading}</h2>
            <p className="text-sm font-semibold tabular-nums text-neutral-200">{formatGBP(sum(sec.lines))}</p>
          </div>
          <FeeTable lines={sec.lines} dateHeader={sec.predicted ? "Predicted" : "Exchanged"} />
        </section>
      ))}

      {/* Referral income (separate stream) */}
      {showReferrals && (
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Referral income · providers <span className="text-neutral-600 normal-case tracking-normal">(separate stream)</span>
            </h2>
            <p className="text-sm font-semibold tabular-nums text-neutral-200">{formatGBP(referralTotal)}</p>
          </div>
          <ReferralTable lines={data.referralLines} />
        </section>
      )}

      {/* Grand total for the metric (sale fees only — referrals are separate). */}
      <div className="flex items-baseline justify-between border-t border-neutral-800 pt-4">
        <p className="text-sm font-semibold text-neutral-300">{meta.title}</p>
        <p className="text-xl font-semibold tabular-nums text-emerald-400">{formatGBP(grandTotal)}</p>
      </div>
    </div>
  );
}

function FeeTable({ lines, dateHeader }: { lines: RevenueLine[]; dateHeader: string }) {
  if (lines.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
        <p className="text-sm text-neutral-600">Nothing here yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
      <table className="w-full border-collapse text-[13px] min-w-[560px]">
        <thead>
          <tr className="bg-neutral-950/60 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Property</th>
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">{dateHeader}</th>
            <th className="text-right font-semibold px-4 py-2.5 border-b border-neutral-800">Fee</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-800/70 last:border-0">
              <td className="px-4 py-2.5 text-neutral-200">{l.address}</td>
              <td className="px-4 py-2.5 text-neutral-400">{l.agencyName}</td>
              <td className="px-4 py-2.5 text-neutral-500 whitespace-nowrap">{l.date ? formatShortDate(l.date) : "—"}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-neutral-200">{formatGBP(l.pence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferralTable({ lines }: { lines: ReferralLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-6">
        <p className="text-sm text-neutral-600">No referral income yet.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
      <table className="w-full border-collapse text-[13px] min-w-[620px]">
        <thead>
          <tr className="bg-neutral-950/60 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Provider</th>
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Property</th>
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
            <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Status</th>
            <th className="text-right font-semibold px-4 py-2.5 border-b border-neutral-800">Fee</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-800/70 last:border-0">
              <td className="px-4 py-2.5 text-neutral-200">{l.providerName}</td>
              <td className="px-4 py-2.5 text-neutral-400">{l.address}</td>
              <td className="px-4 py-2.5 text-neutral-500">{l.agencyName}</td>
              <td className="px-4 py-2.5">
                <span className={`text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full border ${l.collected ? "text-emerald-400 bg-emerald-950/50 border-emerald-900" : "text-amber-400 bg-amber-950/50 border-amber-900"}`}>
                  {l.collected ? "Collected" : "Outstanding"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-neutral-200">{formatGBP(l.pence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
