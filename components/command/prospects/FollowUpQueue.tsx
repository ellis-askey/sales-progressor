"use client";

import { useState } from "react";
import { ProspectDrawer } from "./ProspectDrawer";
import { STATUS_LABEL, STATUS_TONE, SOURCE_LABEL } from "@/lib/command/prospect-labels";
import type { FollowUpRow } from "@/lib/command/prospects";

function fmt(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function FollowUpQueue({ rows }: { rows: FollowUpRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const now = Date.now();

  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-neutral-600 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-8 text-center">Nothing in this bucket. Nice and clear.</p>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
          {rows.map((r) => {
            const overdue = r.dueDate.getTime() <= now;
            return (
              <button key={r.id} onClick={() => setOpenId(r.id)} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-neutral-800/40 transition-colors">
                <div className="w-16 shrink-0">
                  <div className={`text-xs font-medium ${overdue ? "text-amber-400" : "text-neutral-300"}`}>{fmt(r.dueDate)}</div>
                  {r.isRevisit && <div className="text-[10px] text-violet-400/80">revisit</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-neutral-100 font-medium">{r.agencyName}</span>
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    <span className="text-[10px] text-neutral-600">{SOURCE_LABEL[r.source]}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                    {[r.primaryContactName, r.location].filter(Boolean).join(" · ")}
                    {r.lastActivity ? ` — last: ${r.lastActivity}` : ""}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-neutral-600">{r.daysSinceContact != null ? `${r.daysSinceContact}d since contact` : "not contacted"}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {openId && <ProspectDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
