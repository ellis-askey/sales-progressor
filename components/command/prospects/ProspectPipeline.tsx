"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProspectDrawer } from "./ProspectDrawer";
import { changeProspectStatusAction } from "@/app/actions/prospects";
import { STATUS_LABEL, STATUS_TONE, SOURCE_LABEL, PROSPECT_STATUSES } from "@/lib/command/prospect-labels";
import type { PipelineColumn } from "@/lib/command/prospects";
import type { ProspectStatus } from "@prisma/client";

type Card = PipelineColumn["cards"][number];

function fmt(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function ProspectPipeline({ columns }: { columns: PipelineColumn[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

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
                  col.cards.map((c) => <PipelineCardView key={c.id} c={c} status={col.status} onOpen={() => setOpenId(c.id)} />)
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

// A pipeline card: click the title to open the file; change the little status
// dropdown to move it to another column without opening anything.
function PipelineCardView({ c, status, onOpen }: { c: Card; status: ProspectStatus; onOpen: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const overdue = !!c.nextFollowUpAt && new Date(c.nextFollowUpAt).getTime() <= Date.now();
  const move = (s: string) => { if (s !== status) startTransition(async () => { await changeProspectStatusAction(c.id, s); router.refresh(); }); };

  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 hover:border-neutral-700 transition-colors ${pending ? "opacity-50" : ""}`}>
      <button onClick={onOpen} className="w-full text-left">
        <div className="text-xs text-neutral-100 font-medium truncate">{c.agencyName}</div>
        <div className="text-[11px] text-neutral-500 truncate">{[c.primaryContactName, c.location].filter(Boolean).join(" · ") || "—"}</div>
      </button>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <select
          value={status}
          onChange={(e) => move(e.target.value)}
          disabled={pending}
          className="text-[10px] bg-neutral-950 text-neutral-400 border border-neutral-800 rounded px-1 py-0.5 max-w-[7.5rem] focus:outline-none focus:border-neutral-600"
          title="Move to another status"
        >
          {PROSPECT_STATUSES.map((s) => <option key={s} value={s} className="bg-neutral-900">{STATUS_LABEL[s]}</option>)}
        </select>
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-neutral-600">{SOURCE_LABEL[c.source]}</span>
          {c.nextFollowUpAt && <span className={`text-[10px] ${overdue ? "text-amber-400" : "text-neutral-500"}`}>{fmt(c.nextFollowUpAt)}</span>}
        </span>
      </div>
    </div>
  );
}
