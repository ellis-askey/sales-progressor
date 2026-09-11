"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setScheduleStatusAction, scheduleDraftAction } from "@/app/actions/content-schedule";
import { DateField } from "@/components/ui/DateField";

// Content pipeline board (docs/active/content-brand/SPEC.md, Phase 5.1). Ready ->
// Approved -> Scheduled -> Published, with easy (re)scheduling. Scheduled means
// prepared + reminded, not auto-published.

type Item = { id: string; channel: string; text: string; pillar: string | null; scheduleStatus: string; scheduledFor: string | null };
type Pipeline = { ready: Item[]; approved: Item[]; scheduled: Item[]; published: Item[] };

function dateLabel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function toInputDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

export function CalendarBoard({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ ok: boolean }>, fd: FormData) {
    startTransition(async () => {
      const res = await action(fd);
      if (res.ok) router.refresh();
    });
  }

  function move(id: string, status: string) {
    const fd = new FormData();
    fd.set("draftId", id);
    fd.set("status", status);
    run(setScheduleStatusAction, fd);
  }
  function schedule(id: string, date: string) {
    if (!date) return;
    const fd = new FormData();
    fd.set("draftId", id);
    fd.set("scheduledFor", date);
    run(scheduleDraftAction, fd);
  }

  const columns: Array<{ key: keyof Pipeline; label: string }> = [
    { key: "ready", label: "Ready" },
    { key: "approved", label: "Approved" },
    { key: "scheduled", label: "Scheduled" },
    { key: "published", label: "Published" },
  ];

  const total = pipeline.ready.length + pipeline.approved.length + pipeline.scheduled.length;

  if (total === 0 && pipeline.published.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-10 text-center">
        <p className="text-sm text-neutral-300 font-medium">Nothing in the pipeline yet</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
          Draft a post in Create, then mark it ready or schedule it. It shows up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {columns.map((col) => {
        const items = pipeline[col.key];
        return (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{col.label}</span>
              <span className="text-[11px] tabular-nums text-neutral-600">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-800 px-3 py-4 text-center text-[11px] text-neutral-700">Empty</p>
            ) : (
              items.map((it) => (
                <div key={it.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <p className="line-clamp-3 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-200">{it.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-600">
                    <span className="rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-neutral-400">{it.channel}</span>
                    {it.scheduledFor && <span className="text-blue-300">{dateLabel(it.scheduledFor)}</span>}
                  </div>

                  {col.key !== "published" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-neutral-800 pt-2">
                      {col.key === "ready" && (
                        <button onClick={() => move(it.id, "approved")} disabled={pending} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-40">Approve</button>
                      )}
                      {col.key === "scheduled" ? (
                        <>
                          <DateField defaultValue={toInputDate(it.scheduledFor)} onChange={(e) => schedule(it.id, e.target.value)} disabled={pending} className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-300 focus:border-blue-600/50 focus:outline-none" wrapperStyle={{ display: "inline-block" }} />
                          <button onClick={() => move(it.id, "approved")} disabled={pending} className="rounded-md px-1.5 py-0.5 text-[11px] text-neutral-500 transition-colors hover:text-neutral-300 disabled:opacity-40">Unschedule</button>
                        </>
                      ) : (
                        <DateField onChange={(e) => schedule(it.id, e.target.value)} disabled={pending} title="Schedule for a date" className="rounded border border-neutral-800 bg-neutral-950 px-1.5 py-0.5 text-[11px] text-neutral-400 focus:border-blue-600/50 focus:outline-none" wrapperStyle={{ display: "inline-block" }} />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
