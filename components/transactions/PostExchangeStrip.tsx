import Link from "next/link";
import type { PostExchangeGroup } from "@/lib/services/transactions";

type Props = {
  groups: PostExchangeGroup[];
  basePath?: string;
};

const urgencyConfig = {
  overdue:   { dot: "bg-red-500",    label: "text-red-600",    badge: "bg-red-50 text-red-600" },
  this_week: { dot: "bg-amber-500",  label: "text-amber-700",  badge: "bg-amber-50 text-amber-700" },
  next_week: { dot: "bg-blue-500",   label: "text-blue-600",   badge: "bg-blue-50 text-blue-600" },
  later:     { dot: "bg-gray-400",   label: "text-gray-600",   badge: "bg-gray-100 text-gray-500" },
  no_date:   { dot: "bg-gray-300",   label: "text-gray-500",   badge: "bg-gray-100 text-gray-400" },
};

export function PostExchangeStrip({ groups, basePath = "/transactions" }: Props) {
  if (groups.length === 0) return null;

  const total = groups.reduce((n, g) => n + g.transactions.length, 0);

  return (
    <div className="bg-white rounded-xl border border-[#e4e9f0]"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div className="px-5 py-4 border-b border-[#f0f4f8] flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Exchanged — Awaiting Completion</p>
          <p className="text-xs text-gray-400 mt-0.5">Files that have exchanged but not yet completed</p>
        </div>
        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
          {total} file{total !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="divide-y divide-[#f0f4f8]">
        {groups.map((group) => {
          const cfg = urgencyConfig[group.urgency];
          return (
            <div key={group.urgency} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.label}`}>
                  {group.label}
                </span>
                <span className="text-xs text-gray-300 ml-auto">
                  {group.transactions.length} file{group.transactions.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-2">
                {group.transactions.map((tx) => {
                  const daysUntil = tx.completionDate
                    ? Math.round((new Date(tx.completionDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                    : null;

                  return (
                    <Link
                      key={tx.id}
                      href={`${basePath}/${tx.id}`}
                      className="flex items-center justify-between group"
                    >
                      <div className="min-w-0">
                        <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors truncate block">
                          {tx.propertyAddress}
                        </span>
                        {tx.purchasers.length > 0 && (
                          <span className="text-xs text-gray-400">{tx.purchasers.join(" & ")}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3 text-right">
                        {tx.completionDate ? (
                          <>
                            <span className="text-xs text-gray-400">
                              {new Date(tx.completionDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                            {daysUntil !== null && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                                {daysUntil < 0
                                  ? `${Math.abs(daysUntil)}d overdue`
                                  : daysUntil === 0
                                  ? "Today"
                                  : `${daysUntil}d`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 italic">No date set</span>
                        )}
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
