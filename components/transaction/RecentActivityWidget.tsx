"use client";

import { useTabContext } from "./TabContext";
import { relativeDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";

type Props = {
  entries: ActivityEntry[];
};

const COMM_TYPE_LABEL: Record<string, string> = {
  internal_note: "Note",
  outbound: "Outbound",
  inbound: "Inbound",
};

const COMM_TYPE_DOT: Record<string, string> = {
  internal_note: "bg-gray-300",
  outbound: "bg-blue-400",
  inbound: "bg-emerald-400",
};

export function RecentActivityWidget({ entries }: Props) {
  const { setActiveTab } = useTabContext();
  const recent = entries.slice(0, 3);

  return (
    <div className="glass-card">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xs font-semibold text-slate-900/70">Recent activity</h3>
        </div>
        <button
          onClick={() => setActiveTab("activity")}
          className="text-xs text-slate-900/40 hover:text-blue-600 transition-colors font-semibold"
        >
          View all →
        </button>
      </div>

      {/* Activity rows */}
      {recent.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-slate-900/30 italic">No activity yet</p>
        </div>
      ) : (
        <div className="divide-y divide-white/15">
          {recent.map((entry) => {
            if (entry.kind === "milestone") {
              return (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900/80 truncate">
                      {entry.isNotRequired ? "N/A — " : ""}{entry.milestoneName}
                    </p>
                    <p className="text-xs text-slate-900/40 mt-0.5">{relativeDate(entry.at)}</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${COMM_TYPE_DOT[entry.type] ?? "bg-slate-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-semibold text-slate-900/70">
                      {COMM_TYPE_LABEL[entry.type] ?? entry.type}
                    </span>
                    {entry.method && (
                      <span className="text-xs text-slate-900/30">· {entry.method}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-900/60 truncate">{entry.content}</p>
                  <p className="text-xs text-slate-900/40 mt-0.5">{relativeDate(entry.at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
