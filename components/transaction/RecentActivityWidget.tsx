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
    <div className="bg-white rounded-xl border border-[#e4e9f0] overflow-hidden"
         style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#f0f4f8] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xs font-semibold text-gray-600">Recent activity</h3>
        </div>
        <button
          onClick={() => setActiveTab("activity")}
          className="text-xs text-gray-400 hover:text-blue-500 transition-colors font-medium"
        >
          View all →
        </button>
      </div>

      {/* Activity rows */}
      {recent.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-gray-300 italic">No activity yet</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f4f8]">
          {recent.map((entry) => {
            if (entry.kind === "milestone") {
              return (
                <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {entry.isNotRequired ? "N/A — " : ""}{entry.milestoneName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{relativeDate(entry.at)}</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${COMM_TYPE_DOT[entry.type] ?? "bg-gray-300"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-gray-600">
                      {COMM_TYPE_LABEL[entry.type] ?? entry.type}
                    </span>
                    {entry.method && (
                      <span className="text-xs text-gray-300">· {entry.method}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{entry.content}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{relativeDate(entry.at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
