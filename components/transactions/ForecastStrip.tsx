// components/transactions/ForecastStrip.tsx
// Dashboard exchange forecast strip — shows active transactions grouped by expected exchange month.

import Link from "next/link";
import type { ForecastMonth } from "@/lib/services/transactions";

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

type Props = {
  months: ForecastMonth[];
  basePath?: string;
};

export function ForecastStrip({ months, basePath = "/transactions" }: Props) {
  if (months.length === 0) return null;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  return (
    <div className="glass-card">
      <div className="px-5 py-4 border-b border-white/20 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900/90">Exchange Forecast</p>
          <p className="text-xs text-slate-900/40 mt-0.5">Active files with a predicted or expected exchange date</p>
        </div>
        <span className="text-xs font-medium text-blue-500 bg-blue-50/60 px-2.5 py-1 rounded-full whitespace-nowrap">
          {months.reduce((n, m) => n + m.transactions.length, 0)}
        </span>
      </div>

      <div className="divide-y divide-white/15">
        {months.map((month) => {
          const isCurrent = month.month === thisMonth && month.year === thisYear;
          return (
            <div key={`${month.year}-${month.month}`} className="pl-5 pr-8 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isCurrent ? "text-blue-600" : "text-slate-900/50"}`}>
                  {month.label}
                </span>
                {isCurrent && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">This month</span>
                )}
                <span className="text-xs text-slate-900/30 ml-auto">
                  {month.transactions.length} file{month.transactions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2.5">
                {month.transactions.map((tx) => {
                  const { line, location } = splitAddress(tx.propertyAddress);
                  return (
                    <Link
                      key={tx.id}
                      href={`${basePath}/${tx.id}`}
                      className="flex items-center justify-between group gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900/75 group-hover:text-blue-600 transition-colors leading-snug">
                          {line}
                        </p>
                        {location && (
                          <p className="text-xs text-slate-900/40 mt-0.5">{location}</p>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-2">
                        {tx.serviceType && (
                          <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            tx.serviceType === "outsourced"
                              ? "bg-indigo-50/70 text-indigo-500 border-indigo-100"
                              : "bg-slate-100/60 text-slate-400 border-slate-200/40"
                          }`}>
                            {tx.serviceType === "outsourced" ? "Out" : "Self"}
                          </span>
                        )}
                        <span className="text-xs text-slate-900/40">
                          {tx.forecastDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
