"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "lucide-react";
import { refreshWeeklyPlanAction } from "@/app/actions/content-settings";
import { pillarLabel } from "@/lib/command/content/pillars";

// Proposed week (docs/active/content-brand/SPEC.md, Phase 5.2). A short, varied
// week the system proposes from the brand + inbox + balance. Ellis drafts the
// ones he agrees with.

type PlanItem = { day: string; pillar: string; idea: string; inboxItemId: string | null };

function agoLabel(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "proposed today";
  if (days === 1) return "proposed yesterday";
  return `proposed ${days} days ago`;
}

export function WeeklyPlanPanel({ plan, generatedAt }: { plan: PlanItem[]; generatedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function refresh() {
    setNote(null);
    startTransition(async () => {
      const res = await refreshWeeklyPlanAction();
      if (!res.ok) setNote("Couldn't propose a week right now. Add to your inbox or brand and try again.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-neutral-600">{plan.length > 0 ? agoLabel(generatedAt) : "No week proposed yet"}</span>
        <button
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
        >
          <Sparkle size={13} className={pending ? "animate-pulse" : ""} />
          {pending ? "Planning…" : plan.length > 0 ? "Propose a new week" : "Propose a week"}
        </button>
      </div>

      {note && <p className="text-[12px] text-amber-400/90">{note}</p>}

      {plan.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
          <p className="text-sm text-neutral-300 font-medium">No proposed week yet</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
            We&rsquo;ll suggest a short, varied week from your brand, inbox and recent balance. Draft the ones you agree
            with.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {plan.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-3">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{s.day.slice(0, 3)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-neutral-100">{s.idea}</p>
                <span className="mt-1 inline-block rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[10.5px] text-neutral-400">{pillarLabel(s.pillar)}</span>
              </div>
              <button
                onClick={() => router.push(s.inboxItemId ? `/command/content/create?item=${s.inboxItemId}` : "/command/content/create")}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500"
              >
                Draft it
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
