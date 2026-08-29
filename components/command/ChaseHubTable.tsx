"use client";

import { useState } from "react";
import { getChaseDetailAction } from "@/app/actions/command-centre";
import { ChaseRepliedToggle } from "@/components/command/ChaseRepliedToggle";
import type { ChaseRow, ChaseType, ChaseDetail } from "@/lib/command/chasing";

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const TONE: Record<string, string> = { good: "text-emerald-400", warn: "text-amber-400", muted: "text-neutral-500" };

export function ChaseHubTable({ type, rows }: { type: ChaseType; rows: ChaseRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChaseDetail | null>(null);
  const [loading, setLoading] = useState(false);

  async function openRow(id: string) {
    setOpenId(id);
    setDetail(null);
    setLoading(true);
    try {
      setDetail(await getChaseDetailAction(type, id));
    } finally {
      setLoading(false);
    }
  }

  const opensTracked = rows.some((r) => r.opensTracked);

  return (
    <>
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-900/60 text-left text-[11px] uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-2.5 font-medium">Sent</th>
                <th className="px-4 py-2.5 font-medium">File</th>
                <th className="px-4 py-2.5 font-medium">Chased</th>
                {opensTracked && <th className="px-4 py-2.5 font-medium">Opened</th>}
                <th className="px-4 py-2.5 font-medium">What happened</th>
                {type === "enquiries" && <th className="px-4 py-2.5 font-medium">Email reply</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-neutral-500">
                    Nothing in the last 8 weeks. This fills up once chasing is switched on.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openRow(r.id)}
                  className="text-neutral-300 cursor-pointer hover:bg-neutral-800/40 transition-colors"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400 tabular-nums">{fmt(r.sentAt)}</td>
                  <td className="px-4 py-2.5 max-w-[220px] truncate" title={r.address}>{r.address}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="text-neutral-200">{r.chasedLabel}</span>
                    {r.chasedSub && <div className="text-[11px] text-neutral-500 truncate max-w-[200px]">{r.chasedSub}</div>}
                  </td>
                  {opensTracked && (
                    <td className="px-4 py-2.5 whitespace-nowrap text-neutral-400">
                      {r.opensTracked ? (r.openedAt ? fmt(r.openedAt) : "—") : <span className="text-neutral-700">n/a</span>}
                    </td>
                  )}
                  <td className={`px-4 py-2.5 whitespace-nowrap font-medium ${TONE[r.outcomeTone]}`}>{r.outcome}</td>
                  {type === "enquiries" && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      {r.canEmailTick && <ChaseRepliedToggle id={r.id} initial={r.repliedByEmail} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {openId && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpenId(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-md h-full bg-neutral-950 border-l border-neutral-800 overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">What we sent</p>
              <button onClick={() => setOpenId(null)} className="text-neutral-500 hover:text-neutral-200 text-sm">Close</button>
            </div>

            {loading && <p className="text-sm text-neutral-500">Loading…</p>}

            {!loading && detail && (
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-neutral-600 mb-0.5">Subject</p>
                  <p className="text-sm text-neutral-100 font-medium">{detail.subject}</p>
                </div>

                <dl className="grid grid-cols-1 gap-1.5">
                  {detail.meta.map((m) => (
                    <div key={m.label} className="flex justify-between gap-4 text-xs border-b border-neutral-900 pb-1.5">
                      <dt className="text-neutral-500 shrink-0">{m.label}</dt>
                      <dd className="text-neutral-300 text-right">{m.value}</dd>
                    </div>
                  ))}
                </dl>

                <div>
                  <p className="text-[11px] text-neutral-600 mb-1">Message</p>
                  {detail.body ? (
                    <pre className="text-xs text-neutral-300 whitespace-pre-wrap font-sans bg-neutral-900 border border-neutral-800 rounded-lg p-3 leading-relaxed">{detail.body}</pre>
                  ) : (
                    <p className="text-xs text-neutral-600 italic">{detail.bodyNote ?? "No stored body."}</p>
                  )}
                  {detail.body && detail.bodyNote && <p className="text-[11px] text-neutral-600 mt-1">{detail.bodyNote}</p>}
                </div>

                {detail.transactionId && (
                  <a href={`/command/files?tx=${detail.transactionId}`} className="inline-block text-xs text-blue-400 hover:text-blue-300">
                    Open the file →
                  </a>
                )}
              </div>
            )}

            {!loading && !detail && <p className="text-sm text-neutral-500">Couldn&rsquo;t load this one.</p>}
          </div>
        </div>
      )}
    </>
  );
}
