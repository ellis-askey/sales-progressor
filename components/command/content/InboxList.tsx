"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle, ArrowRight } from "lucide-react";
import { refreshInboxAction, setInboxItemStatusAction } from "@/app/actions/content-inbox";
import { ClaimBadge } from "@/components/command/content/ClaimBadge";

// Content inbox (docs/active/content-brand/SPEC.md, Phase 1.3). The list of real
// things worth talking about, each with why it's interesting, a few genuinely
// different angles, likely audience and a qualitative reach note. This surface
// identifies interesting things — it doesn't generate posts. Drafting is a
// deliberate second step ("Draft from this").

type Angle = { angle: string; point: string };

type Item = {
  id: string;
  sourceType: string;
  observation: string;
  whyInteresting: string;
  brandFit: string | null;
  reachReason: string | null;
  claimClass: string;
  likelyAudience: string[];
  suggestedAngles: Angle[];
  evidence: Record<string, unknown> | null;
  freshnessAt: string;
  status: string;
};

type Board = { fresh: Item[]; saved: Item[]; counts: { fresh: number; saved: number } };
type Tab = "fresh" | "saved";

const SOURCE_LABEL: Record<string, string> = {
  product_data: "Product data",
  customer_behaviour: "Customer behaviour",
  recurring_issue: "Recurring issue",
  product_dev: "Product update",
  saved_thought: "Your thought",
  customer_question: "Customer question",
  feedback: "Feedback",
  milestone: "Milestone",
  revisit: "Worth revisiting",
  industry_news: "Industry",
  manual: "Manual",
};

function freshness(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

export function InboxList({ board }: { board: Board }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fresh");
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    setNote(null);
    startTransition(async () => {
      const r = await refreshInboxAction();
      const bits: string[] = [];
      bits.push(r.added === 1 ? "1 new item" : `${r.added} new items`);
      if (r.skippedExisting > 0) bits.push(`${r.skippedExisting} already seen`);
      if (r.deferred > 0) bits.push(`${r.deferred} saved for next refresh`);
      setNote(r.added === 0 && r.deferred === 0 ? "Nothing new right now." : bits.join(" · "));
      router.refresh();
    });
  }

  const list = board[tab];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {(["fresh", "saved"] as Tab[]).map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
                  on ? "bg-blue-600/20 text-blue-300 border-blue-600/40" : "bg-neutral-900 text-neutral-500 border-neutral-800 hover:text-neutral-300 hover:border-neutral-700"
                }`}
              >
                {t === "fresh" ? "Fresh" : "Saved"} <span className="tabular-nums text-neutral-500">{board.counts[t]}</span>
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
            {pending ? "Finding…" : "Refresh"}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-12 text-center">
          <p className="text-sm text-neutral-300 font-medium">
            {tab === "fresh" ? "Nothing in the inbox yet" : "Nothing saved"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            {tab === "fresh"
              ? "Hit Refresh and we'll surface real things worth talking about from your data, activity and saved thoughts."
              : "Save an item from Fresh to keep it here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((it) => (
            <InboxCard
              key={it.id}
              it={it}
              tab={tab}
              pending={pending}
              onStatus={(status) => {
                const fd = new FormData();
                fd.set("id", it.id);
                fd.set("status", status);
                startTransition(async () => {
                  const res = await setInboxItemStatusAction(fd);
                  if (res.ok) router.refresh();
                });
              }}
              onDraft={() => router.push(`/command/content/create?item=${it.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InboxCard({
  it, tab, pending, onStatus, onDraft,
}: {
  it: Item;
  tab: Tab;
  pending: boolean;
  onStatus: (status: string) => void;
  onDraft: () => void;
}) {
  const [open, setOpen] = useState(false);
  const figures = it.evidence && typeof it.evidence.figures === "object" ? (it.evidence.figures as Record<string, unknown>) : null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2 text-[10.5px] text-neutral-600">
        <span className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-neutral-300">{SOURCE_LABEL[it.sourceType] ?? it.sourceType}</span>
        <ClaimBadge id={it.claimClass} />
        <span className="ml-auto">{freshness(it.freshnessAt)}</span>
      </div>

      <p className="mt-2.5 text-[14.5px] font-medium leading-snug text-neutral-100">{it.observation}</p>
      {it.whyInteresting && <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">{it.whyInteresting}</p>}

      {it.reachReason && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-neutral-500">
          <Sparkle size={12} className="mt-0.5 shrink-0 text-neutral-600" />
          <span>{it.reachReason}</span>
        </p>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-neutral-800 pt-3">
          {it.brandFit && (
            <p className="text-[12px] text-neutral-400"><span className="text-neutral-600">Fits your brand: </span>{it.brandFit}</p>
          )}

          {it.likelyAudience.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-neutral-600">Reaches</span>
              {it.likelyAudience.map((a) => (
                <span key={a} className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-300">{a}</span>
              ))}
            </div>
          )}

          {figures && (
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-2.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">Evidence</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(figures).map(([k, v]) => (
                  <span key={k} className="text-[11px] tabular-nums text-neutral-400">
                    <span className="text-neutral-600">{k}:</span> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {it.suggestedAngles.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">Angles you could take</p>
              {it.suggestedAngles.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
                  <span className="mt-0.5 rounded border border-neutral-700 bg-neutral-800/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-300">{a.angle}</span>
                  <span className="flex-1 text-[12.5px] leading-relaxed text-neutral-300">{a.point}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-neutral-600">No angles yet. Draft from the observation, or refresh to enrich it.</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
        >
          {open ? "Less" : "Explore"}
        </button>
        <button
          onClick={onDraft}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500"
        >
          Draft from this <ArrowRight size={12} />
        </button>

        <span className="ml-auto flex items-center gap-1">
          {tab === "fresh" ? (
            <Action label="Save" onClick={() => onStatus("saved")} disabled={pending} />
          ) : (
            <Action label="Back to fresh" onClick={() => onStatus("new")} disabled={pending} />
          )}
          <Action label="Already said" onClick={() => onStatus("already_said")} disabled={pending} />
          <Action label="Not me" onClick={() => onStatus("not_me")} disabled={pending} />
          <Action label="Dismiss" onClick={() => onStatus("dismissed")} disabled={pending} danger />
        </span>
      </div>
    </div>
  );
}

function Action({ label, onClick, disabled, danger }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
        danger ? "text-neutral-500 hover:bg-red-950/40 hover:text-red-300" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      }`}
    >
      {label}
    </button>
  );
}
