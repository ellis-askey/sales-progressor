// components/transactions/ForecastStrip.tsx
// Dashboard exchange forecast strip — shows active transactions grouped by expected exchange month.

import Link from "next/link";
import type { ForecastMonth } from "@/lib/services/transactions";

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
    <div className="bg-white rounded-xl border border-[#e4e9f0]"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div className="px-5 py-4 border-b border-[#f0f4f8] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Exchange Forecast</p>
          <p className="text-xs text-gray-400 mt-0.5">Active files with a predicted or expected exchange date</p>
        </div>
        <span className="text-xs font-medium text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full">
          {months.reduce((n, m) => n + m.transactions.length, 0)} file{months.reduce((n, m) => n + m.transactions.length, 0) !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-[#f0f4f8]">
        {months.map((month) => {
          const isCurrent = month.month === thisMonth && month.year === thisYear;
          return (
            <div key={`${month.year}-${month.month}`} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isCurrent ? "text-blue-600" : "text-gray-500"}`}>
                  {month.label}
                </span>
                {isCurrent && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">This month</span>
                )}
                <span className="text-xs text-gray-300 ml-auto">
                  {month.transactions.length} file{month.transactions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-1.5">
                {month.transactions.map((tx) => (
                  <Link
                    key={tx.id}
                    href={`${basePath}/${tx.id}`}
                    className="flex items-center justify-between group"
                  >
                    <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors truncate">
                      {tx.propertyAddress}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                      {tx.forecastDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
