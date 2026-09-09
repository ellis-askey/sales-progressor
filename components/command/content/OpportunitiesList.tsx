"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle, ArrowRight } from "lucide-react";
import { refreshOpportunitiesAction, setOpportunityStatusAction } from "@/app/actions/brand-opportunities";
import { OPPORTUNITY_KIND_LABELS, DRAFTABLE_KINDS } from "@/lib/command/content/opportunity-kinds";
import { ClaimBadge } from "@/components/command/content/ClaimBadge";

// Brand opportunities (docs/active/content-brand/SPEC.md, Phase 2.1). Higher-
// level reputation moves, not single posts: positions, articles, series, press,
// podcasts, case studies. Refresh proposes; Ellis pursues or dismisses.

type Item = {
  id: string;
  kind: string;
  title: string;
  rationale: string;
  suggestedAction: string;
  audience: string[];
  effort: string | null;
  horizon: string | null;
  brandFit: string | null;
  claimClass: string;
  status: string;
};

type Board = { open: Item[]; pursuing: Item[]; counts: { open: number; pursuing: number } };
type Tab = "open" | "pursuing";

const HORIZON_LABEL: Record<string, string> = { now: "Now", soon: "Soon", ongoing: "Ongoing" };

export function OpportunitiesList({ board }: { board: Board }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("open");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    setNote(null);
    startTransition(async () => {
      const r = await refreshOpportunitiesAction();
      setNote(
        r.added === 0
          ? "Nothing new right now. Add to your brand and try again."
          : `${r.added} new${r.skippedExisting ? ` · ${r.skippedExisting} already seen` : ""}`,
      );
      router.refresh();
    });
  }

  function status(id: string, s: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", s);
    startTransition(async () => {
      const res = await setOpportunityStatusAction(fd);
      if (res.ok) router.refresh();
    });
  }

  const list = board[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["open", "pursuing"] as Tab[]).map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                  on ? "bg-blue-600/20 text-blue-300 border-blue-600/40" : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
                }`}
              >
                {t === "open" ? "Open" : "Pursuing"} <span className="tabular-nums text-neutral-500">{board.counts[t]}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {note && <span className="text-[11px] text-neutral-500">{note}</span>}
          <button
            onClick={refresh}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
          >
            <Sparkle size={13} className={pending ? "animate-pulse" : ""} />
            {pending ? "Thinking…" : "Refresh"}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-12 text-center">
          <p className="text-sm text-neutral-300 font-medium">{tab === "open" ? "No opportunities yet" : "Nothing being pursued"}</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            {tab === "open"
              ? "Set your positioning and add a few things to brand memory, then Refresh. The stronger your brand, the better these get."
              : "Pursue an open opportunity to keep it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((it) => (
            <div key={it.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 font-medium text-blue-300">
                  {OPPORTUNITY_KIND_LABELS[it.kind] ?? it.kind}
                </span>
                {it.horizon && <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-neutral-300">{HORIZON_LABEL[it.horizon] ?? it.horizon}</span>}
                {it.effort && <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-neutral-400">{it.effort} effort</span>}
                <ClaimBadge id={it.claimClass} />
              </div>

              <p className="mt-2.5 text-[15px] font-semibold leading-snug text-neutral-100">{it.title}</p>
              {it.rationale && <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">{it.rationale}</p>}
              {it.suggestedAction && (
                <p className="mt-2 text-[12.5px] text-neutral-300"><span className="text-neutral-600">Next: </span>{it.suggestedAction}</p>
              )}
              {it.audience.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-neutral-600">Reaches</span>
                  {it.audience.map((a) => (
                    <span key={a} className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-300">{a}</span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {DRAFTABLE_KINDS.has(it.kind) && (
                  <button
                    onClick={() => router.push(`/command/content/create?opp=${it.id}`)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500"
                  >
                    Draft it <ArrowRight size={12} />
                  </button>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {tab === "open" ? (
                    <Action label="Pursue" onClick={() => status(it.id, "pursuing")} disabled={pending} good />
                  ) : (
                    <>
                      <Action label="Mark done" onClick={() => status(it.id, "done")} disabled={pending} good />
                      <Action label="Back to open" onClick={() => status(it.id, "new")} disabled={pending} />
                    </>
                  )}
                  <Action label="Dismiss" onClick={() => status(it.id, "dismissed")} disabled={pending} danger />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Action({ label, onClick, disabled, danger, good }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; good?: boolean }) {
  const tone = danger
    ? "text-neutral-500 hover:bg-red-950/40 hover:text-red-300"
    : good
    ? "text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-200"
    : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${tone}`}>
      {label}
    </button>
  );
}
