"use client";

import { useState } from "react";
import Link from "next/link";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AgentRequestsPanel({ requests }: { requests: ManualTaskWithRelations[] }) {
  const [open, setOpen] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const pending  = requests.filter((r) => r.status === "open");
  const resolved = requests.filter((r) => r.status === "done");

  return (
    <div className="glass-card">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-sm font-semibold text-slate-900/80">My requests</span>
          {pending.length > 0 && (
            <span className="text-xs font-medium bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-900/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/20">
          {pending.length === 0 && resolved.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-900/40 text-center">No requests raised yet.</p>
          ) : (
            <>
              {pending.length === 0 ? (
                <p className="px-5 py-4 text-sm text-slate-900/40">All requests resolved.</p>
              ) : (
                <div className="divide-y divide-white/15">
                  {pending.map((r) => (
                    <RequestRow key={r.id} request={r} />
                  ))}
                </div>
              )}

              {resolved.length > 0 && (
                <div className="px-5 py-3 border-t border-white/15">
                  <button
                    onClick={() => setShowResolved((v) => !v)}
                    className="text-xs text-slate-900/40 hover:text-slate-900/60"
                  >
                    {showResolved ? "Hide resolved" : `Show ${resolved.length} resolved`}
                  </button>
                  {showResolved && (
                    <div className="mt-3 space-y-2">
                      {resolved.map((r) => (
                        <RequestRow key={r.id} request={r} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({ request }: { request: ManualTaskWithRelations }) {
  const isDone = request.status === "done";
  return (
    <div className={`px-5 py-3.5 flex items-start gap-3 ${isDone ? "opacity-50" : ""}`}>
      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${isDone ? "bg-emerald-400" : "bg-amber-400"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-slate-900/80 leading-snug ${isDone ? "line-through" : "font-medium"}`}>
          {request.title}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {request.transaction && (
            <Link
              href={`/agent/transactions/${request.transactionId}`}
              className="text-xs text-blue-500 hover:text-blue-600 truncate max-w-[200px]"
            >
              {request.transaction.propertyAddress}
            </Link>
          )}
          <span className="text-xs text-slate-900/40">{fmtDate(request.createdAt)}</span>
        </div>
      </div>
      <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
        isDone ? "bg-emerald-100/80 text-emerald-700" : "bg-amber-100/80 text-amber-700"
      }`}>
        {isDone ? "Resolved" : "Pending"}
      </span>
    </div>
  );
}
