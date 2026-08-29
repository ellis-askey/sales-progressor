"use client";

import { useState } from "react";
import { ProspectDrawer } from "./ProspectDrawer";
import { STATUS_LABEL, STATUS_TONE, SOURCE_LABEL } from "@/lib/command/prospect-labels";
import type { PipelineColumn } from "@/lib/command/prospects";

function fmt(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ProspectPipeline({ columns }: { columns: PipelineColumn[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const now = Date.now();

  return (
    <>
      <div className="overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-2">
          {columns.map((col) => (
            <div key={col.status} className="w-56 shrink-0">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_TONE[col.status]}`}>{STATUS_LABEL[col.status]}</span>
                <span className="text-[11px] text-neutral-600 tabular-nums">{col.cards.length}</span>
              </div>
              <div className="space-y-2">
                {col.cards.length === 0 ? (
                  <p className="text-[11px] text-neutral-700 px-1">—</p>
                ) : (
                  col.cards.map((c) => {
                    const overdue = !!c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= now;
                    return (
                      <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full text-left bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 hover:border-neutral-700 transition-colors">
                        <div className="text-xs text-neutral-100 font-medium truncate">{c.agencyName}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{[c.primaryContactName, c.location].filter(Boolean).join(" · ") || "—"}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-neutral-600">{SOURCE_LABEL[c.source]}</span>
                          {c.nextFollowUpAt && <span className={`text-[10px] ${overdue ? "text-amber-400" : "text-neutral-500"}`}>{fmt(c.nextFollowUpAt)}</span>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {openId && <ProspectDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
